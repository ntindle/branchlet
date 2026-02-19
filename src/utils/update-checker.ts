import { mkdir, readFile, writeFile } from "node:fs/promises"
import { GLOBAL_CONFIG_DIR, UPDATE_CHECK_FILE } from "../constants/default-config.js"

export interface UpdateInfo {
  current: string
  latest: string
}

interface CacheData {
  lastCheck: number
  latestVersion: string
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 3000

function isNewer(latest: string, current: string): boolean {
  const latestParts = latest.split(".").map(Number)
  const currentParts = current.split(".").map(Number)

  for (let i = 0; i < 3; i++) {
    const l = latestParts[i] ?? 0
    const c = currentParts[i] ?? 0
    if (l > c) return true
    if (l < c) return false
  }
  return false
}

export async function checkForUpdate(
  currentVersion: string,
  packageName: string,
  forceCheck?: boolean
): Promise<UpdateInfo | null> {
  try {
    let latestVersion: string | undefined

    if (!forceCheck) {
      try {
        const cacheContent = await readFile(UPDATE_CHECK_FILE, "utf-8")
        const cache: CacheData = JSON.parse(cacheContent)

        if (Date.now() - cache.lastCheck < CHECK_INTERVAL_MS) {
          latestVersion = cache.latestVersion
        }
      } catch {
        // Cache doesn't exist or is invalid
      }
    }

    if (!latestVersion) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      try {
        const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
          signal: controller.signal,
        })
        const data = (await response.json()) as { version: string }
        latestVersion = data.version
      } finally {
        clearTimeout(timeout)
      }

      if (latestVersion) {
        try {
          await mkdir(GLOBAL_CONFIG_DIR, { recursive: true })
          await writeFile(
            UPDATE_CHECK_FILE,
            JSON.stringify({ lastCheck: Date.now(), latestVersion })
          )
        } catch {
          // Ignore write errors
        }
      }
    }

    if (latestVersion && isNewer(latestVersion, currentVersion)) {
      return { current: currentVersion, latest: latestVersion }
    }

    return null
  } catch {
    return null
  }
}
