import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { WorktreeConfigSchema } from "../src/schemas/config-schema"

const jsonSchema = z.toJSONSchema(WorktreeConfigSchema) as Record<string, unknown>
delete jsonSchema.required
delete jsonSchema.additionalProperties
const generated = `${JSON.stringify(jsonSchema, null, 2)}\n`
const committed = await readFile(join(import.meta.dir, "..", "schema.json"), "utf-8")
if (generated !== committed) {
  console.error("schema.json is out of sync. Run: bun run generate:schema")
  process.exit(1)
}
console.log("schema.json is up to date.")
