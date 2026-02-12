import { WorktreeConfigSchema } from "../schemas/config-schema.js"

export const DEFAULT_CONFIG = WorktreeConfigSchema.parse({})
export const LOCAL_CONFIG_FILE_NAME = ".branchlet.json"
export const GLOBAL_CONFIG_DIR = `${process.env.HOME}/.branchlet`
export const GLOBAL_CONFIG_FILE = `${GLOBAL_CONFIG_DIR}/settings.json`
export const UPDATE_CHECK_FILE = `${GLOBAL_CONFIG_DIR}/.update-check`
