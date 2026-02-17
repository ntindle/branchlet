import { dirname } from "node:path"
import type { WorktreeService } from "../../services/index.js"
import {
  getWorktreePath,
  validateBranchName,
  validateDirectoryName,
} from "../../utils/path-utils.js"
import type { CliArgs } from "../types.js"

export async function runCreate(args: CliArgs, worktreeService: WorktreeService): Promise<void> {
  if (!args.name) {
    throw new Error("Missing required argument: --name (-n)")
  }
  if (!args.source) {
    throw new Error("Missing required argument: --source (-s)")
  }

  const dirError = validateDirectoryName(args.name)
  if (dirError) {
    throw new Error(`Invalid directory name: ${dirError}`)
  }

  const config = worktreeService.getConfigService().getConfig()
  const gitService = worktreeService.getGitService()
  const repoInfo = await gitService.getRepositoryInfo()

  const allBranches = await gitService.listBranches(config.showRemoteBranches)
  const sourceBranchInfo = allBranches.find((b) => b.name === args.source)
  if (!sourceBranchInfo) {
    throw new Error(`Source branch '${args.source}' does not exist`)
  }

  // When --branch is omitted and source is remote (e.g. "origin/feat/foo"),
  // default to the local name ("feat/foo") so git creates a tracking branch.
  let defaultBranch = args.source
  if (!args.branch && sourceBranchInfo.isRemote) {
    defaultBranch = args.source.replace(/^[^/]+\//, "")
  }
  const newBranch = args.branch ?? defaultBranch
  if (args.branch) {
    const branchError = validateBranchName(args.branch)
    if (branchError) {
      throw new Error(`Invalid branch name: ${branchError}`)
    }
  }

  const worktreePath = getWorktreePath(
    repoInfo.path,
    args.name,
    config.worktreePathTemplate,
    newBranch,
    args.source
  )
  const basePath = dirname(worktreePath)

  await worktreeService.createWorktree({
    name: args.name,
    sourceBranch: args.source,
    newBranch,
    basePath,
    isRemoteSource: sourceBranchInfo.isRemote,
  })

  console.log(worktreePath)
}
