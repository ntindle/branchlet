import { spawn } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { afterAll, describe, expect, test } from "bun:test"
import { MESSAGES } from "../../src/constants/messages.js"

const CLI_PATH = resolve(import.meta.dir, "../../dist/index.js")

function runInNonTty(
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const timeout = options?.timeout ?? 10_000
  return new Promise((resolve, reject) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      cwd: options?.cwd,
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
    })

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Process timed out after ${timeout}ms`))
    }, timeout)

    child.on("close", (exitCode) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode })
    })

    child.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })

    // Close stdin immediately to ensure non-TTY behavior
    child.stdin.end()
  })
}

describe("Non-TTY behavior", () => {
  describe("interactive commands should error gracefully", () => {
    test("bare invocation should print error with menu hint", async () => {
      const result = await runInNonTty([])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(MESSAGES.ERROR_NO_TTY)
      expect(result.stderr).toContain(MESSAGES.ERROR_NO_TTY_MENU)
    })

    test("create without flags should print error with create hint", async () => {
      const result = await runInNonTty(["create"])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(MESSAGES.ERROR_NO_TTY)
      expect(result.stderr).toContain(MESSAGES.ERROR_NO_TTY_CREATE)
    })

    test("delete without flags should print error with delete hint", async () => {
      const result = await runInNonTty(["delete"])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(MESSAGES.ERROR_NO_TTY)
      expect(result.stderr).toContain(MESSAGES.ERROR_NO_TTY_DELETE)
    })

    test("settings should print error with settings hint", async () => {
      const result = await runInNonTty(["settings"])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(MESSAGES.ERROR_NO_TTY)
      expect(result.stderr).toContain(MESSAGES.ERROR_NO_TTY_SETTINGS)
    })
  })

  describe("list command auto-promotes to JSON", () => {
    test("bare list should output valid JSON", async () => {
      const result = await runInNonTty(["list"])

      expect(result.exitCode).toBe(0)
      expect(result.stderr).not.toContain(MESSAGES.ERROR_NO_TTY)

      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBeGreaterThan(0)

      for (const worktree of parsed) {
        expect(worktree).toHaveProperty("path")
        expect(worktree).toHaveProperty("branch")
        expect(worktree).toHaveProperty("commit")
      }
    })

    test("list --json should still work explicitly", async () => {
      const result = await runInNonTty(["list", "--json"])

      expect(result.exitCode).toBe(0)

      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBeGreaterThan(0)
    })
  })

  describe("non-interactive CLI mode still works in non-TTY", () => {
    test("create with all required flags should not get TTY error", async () => {
      const result = await runInNonTty(["create", "-n", "nonexistent-test", "-s", "nonexistent-branch-xyz"])

      // It will fail due to invalid branch, but NOT due to TTY detection
      expect(result.stderr).not.toContain(MESSAGES.ERROR_NO_TTY)
    })

    test("delete with --name flag should not get TTY error", async () => {
      const result = await runInNonTty(["delete", "-n", "nonexistent-worktree"])

      // It will fail due to no matching worktree, but NOT due to TTY detection
      expect(result.stderr).not.toContain(MESSAGES.ERROR_NO_TTY)
    })
  })

  describe("help and version still work in non-TTY", () => {
    test("--help should print usage and exit 0", async () => {
      const result = await runInNonTty(["--help"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Usage:")
      expect(result.stdout).toContain("branchlet")
    })

    test("--version should print version and exit 0", async () => {
      const result = await runInNonTty(["--version"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Branchlet v\d+\.\d+\.\d+/)
    })
  })

  describe("postCreateCmd failure output", () => {
    const tempDir = join(tmpdir(), `branchlet-test-postcreate-${Date.now()}`)

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true })
    })

    test("should surface postCreateCmd failures on stderr", async () => {
      // Set up a temp git repo with a .branchlet.json that has a failing postCreateCmd
      await mkdir(tempDir, { recursive: true })

      // Init git repo with a commit so we have a branch to work with
      const git = (args: string) =>
        new Promise<void>((res, rej) => {
          const child = spawn("git", args.split(" "), { cwd: tempDir, stdio: "pipe" })
          child.on("close", (code) => (code === 0 ? res() : rej(new Error(`git ${args} failed`))))
        })

      await git("init")
      await git("checkout -b main")
      await writeFile(join(tempDir, "file.txt"), "hello")
      await git("add .")
      await git("-c user.name=Test -c user.email=test@test.com commit -m init")

      // Write config with a command that will fail
      await writeFile(
        join(tempDir, ".branchlet.json"),
        JSON.stringify({
          postCreateCmd: ["this-command-does-not-exist-xyz"],
          worktreeCopyPatterns: [],
          worktreeCopyIgnores: [],
          terminalCommand: "",
        })
      )

      const branchName = `test-postcreate-fail-${Date.now()}`
      const result = await runInNonTty(
        ["create", "-n", `wt-${Date.now()}`, "-s", "main", "-b", branchName],
        { cwd: tempDir, timeout: 15_000 }
      )

      expect(result.stderr).toContain("Warning: post-create command failed:")
      expect(result.stderr).toContain("this-command-does-not-exist-xyz")
    })
  })
})
