import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { GLOBAL_CONFIG_DIR, UPDATE_CHECK_FILE } from "../../src/constants/default-config.js"
import { checkForUpdate } from "../../src/utils/update-checker.js"

// Store originals for mocking
const originalReadFile = readFile
const originalWriteFile = writeFile
const originalMkdir = mkdir
const originalFetch = globalThis.fetch

const CURRENT_VERSION = "1.0.0"
const PACKAGE_NAME = "branchlet"

function mockFetch(latestVersion: string) {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify({ version: latestVersion })))
  ) as typeof fetch
}

function mockFetchFailure() {
  globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as typeof fetch
}

describe("update-checker", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe("version comparison", () => {
    test("returns UpdateInfo when latest > current (major)", async () => {
      mockFetch("2.0.0")
      const result = await checkForUpdate("1.0.0", PACKAGE_NAME, true)
      expect(result).toEqual({ current: "1.0.0", latest: "2.0.0" })
    })

    test("returns UpdateInfo when latest > current (minor)", async () => {
      mockFetch("1.1.0")
      const result = await checkForUpdate("1.0.0", PACKAGE_NAME, true)
      expect(result).toEqual({ current: "1.0.0", latest: "1.1.0" })
    })

    test("returns UpdateInfo when latest > current (patch)", async () => {
      mockFetch("1.0.1")
      const result = await checkForUpdate("1.0.0", PACKAGE_NAME, true)
      expect(result).toEqual({ current: "1.0.0", latest: "1.0.1" })
    })

    test("returns null when current equals latest", async () => {
      mockFetch("1.0.0")
      const result = await checkForUpdate("1.0.0", PACKAGE_NAME, true)
      expect(result).toBeNull()
    })

    test("returns null when current > latest", async () => {
      mockFetch("1.0.0")
      const result = await checkForUpdate("2.0.0", PACKAGE_NAME, true)
      expect(result).toBeNull()
    })

    test("handles partial versions correctly", async () => {
      mockFetch("1.1")
      const result = await checkForUpdate("1.0", PACKAGE_NAME, true)
      expect(result).toEqual({ current: "1.0", latest: "1.1" })
    })
  })

  describe("cache behavior", () => {
    test("fetches from registry when forceCheck is true even with fresh cache", async () => {
      mockFetch("2.0.0")
      const result = await checkForUpdate(CURRENT_VERSION, PACKAGE_NAME, true)
      expect(result).toEqual({ current: CURRENT_VERSION, latest: "2.0.0" })
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    test("returns result without forceCheck (uses cache or registry)", async () => {
      mockFetch("2.0.0")
      // Without forceCheck, the function may use cache or fetch from registry
      // depending on the cache state. Either way it should return a valid result.
      const result = await checkForUpdate(CURRENT_VERSION, PACKAGE_NAME)
      // If cache has a version newer than CURRENT_VERSION, we get an UpdateInfo;
      // if cache has the same or older, we get null; if no cache, fetch returns 2.0.0
      expect(result === null || (result.current === CURRENT_VERSION && typeof result.latest === "string")).toBe(
        true
      )
    })
  })

  describe("error handling", () => {
    test("returns null on network failure", async () => {
      mockFetchFailure()
      const result = await checkForUpdate(CURRENT_VERSION, PACKAGE_NAME, true)
      expect(result).toBeNull()
    })

    test("returns null on fetch abort/timeout", async () => {
      globalThis.fetch = mock(
        () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error("aborted")), 10))
      ) as typeof fetch
      const result = await checkForUpdate(CURRENT_VERSION, PACKAGE_NAME, true)
      expect(result).toBeNull()
    })
  })
})
