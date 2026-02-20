import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { WorktreeConfigSchema } from "../src/schemas/config-schema"

const jsonSchema = z.toJSONSchema(WorktreeConfigSchema) as Record<string, unknown>

// All fields have .default() so none are truly required for user config files
delete jsonSchema.required

// Allow $schema key and any other extra properties in user config files
delete jsonSchema.additionalProperties

const outPath = join(import.meta.dir, "..", "schema.json")
await writeFile(outPath, `${JSON.stringify(jsonSchema, null, 2)}\n`)
console.log(`Written: ${outPath}`)
