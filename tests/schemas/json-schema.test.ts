import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { WorktreeConfigSchema } from "../../src/schemas/config-schema.js"

const schemaPath = join(import.meta.dir, "..", "..", "schema.json")

describe("JSON Schema generation", () => {
  describe("z.toJSONSchema output", () => {
    test("should produce a valid JSON Schema object", () => {
      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema)
      expect(jsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema")
      expect(jsonSchema.type).toBe("object")
      expect(jsonSchema.properties).toBeDefined()
    })

    test("should include all 7 config fields", () => {
      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema)
      const props = jsonSchema.properties as Record<string, unknown>
      const expectedFields = [
        "worktreeCopyPatterns",
        "worktreeCopyIgnores",
        "worktreePathTemplate",
        "postCreateCmd",
        "terminalCommand",
        "deleteBranchWithWorktree",
        "showRemoteBranches",
      ]
      for (const field of expectedFields) {
        expect(props[field]).toBeDefined()
      }
      expect(Object.keys(props)).toHaveLength(7)
    })

    test("should have descriptions on all fields", () => {
      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema)
      const props = jsonSchema.properties as Record<string, Record<string, unknown>>
      for (const [key, value] of Object.entries(props)) {
        expect(typeof value.description).toBe("string")
        expect((value.description as string).length).toBeGreaterThan(0)
      }
    })

    test("should have defaults on all fields", () => {
      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema)
      const props = jsonSchema.properties as Record<string, Record<string, unknown>>
      for (const [key, value] of Object.entries(props)) {
        expect(value.default).toBeDefined()
      }
    })

    test("should have correct types for each field", () => {
      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema)
      const props = jsonSchema.properties as Record<string, Record<string, unknown>>

      expect(props.worktreeCopyPatterns?.type).toBe("array")
      expect(props.worktreeCopyIgnores?.type).toBe("array")
      expect(props.worktreePathTemplate?.type).toBe("string")
      expect(props.postCreateCmd?.type).toBe("array")
      expect(props.terminalCommand?.type).toBe("string")
      expect(props.deleteBranchWithWorktree?.type).toBe("boolean")
      expect(props.showRemoteBranches?.type).toBe("boolean")
    })

    test("should have correct defaults matching Zod schema", () => {
      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema)
      const props = jsonSchema.properties as Record<string, Record<string, unknown>>

      expect(props.worktreeCopyPatterns?.default).toEqual([".env*", ".vscode/**"])
      expect(props.worktreeCopyIgnores?.default).toEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        "**/Thumbs.db",
        "**/.DS_Store",
      ])
      expect(props.worktreePathTemplate?.default).toBe("$BASE_PATH.worktree")
      expect(props.postCreateCmd?.default).toEqual([])
      expect(props.terminalCommand?.default).toBe("")
      expect(props.deleteBranchWithWorktree?.default).toBe(false)
      expect(props.showRemoteBranches?.default).toBe(true)
    })

    test("should have string items for array fields", () => {
      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema)
      const props = jsonSchema.properties as Record<string, Record<string, unknown>>

      const arrayFields = ["worktreeCopyPatterns", "worktreeCopyIgnores", "postCreateCmd"]
      for (const field of arrayFields) {
        const items = props[field]?.items as Record<string, unknown>
        expect(items?.type).toBe("string")
      }
    })

    test("should include root-level description", () => {
      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema)
      expect(jsonSchema.description).toBe("Configuration for Git worktree management tool")
    })
  })

  describe("committed schema.json", () => {
    test("should be valid JSON", async () => {
      const content = await readFile(schemaPath, "utf-8")
      expect(() => JSON.parse(content)).not.toThrow()
    })

    test("should not have a required array (all fields have defaults)", async () => {
      const content = await readFile(schemaPath, "utf-8")
      const schema = JSON.parse(content)
      expect(schema.required).toBeUndefined()
    })

    test("should not have additionalProperties set (allows $schema key)", async () => {
      const content = await readFile(schemaPath, "utf-8")
      const schema = JSON.parse(content)
      expect(schema.additionalProperties).toBeUndefined()
    })

    test("should match regenerated output", async () => {
      const content = await readFile(schemaPath, "utf-8")

      const jsonSchema = z.toJSONSchema(WorktreeConfigSchema) as Record<string, unknown>
      delete jsonSchema.required
      delete jsonSchema.additionalProperties
      const expected = `${JSON.stringify(jsonSchema, null, 2)}\n`

      expect(content).toBe(expected)
    })

    test("should end with a trailing newline", async () => {
      const content = await readFile(schemaPath, "utf-8")
      expect(content.endsWith("\n")).toBe(true)
    })
  })
})
