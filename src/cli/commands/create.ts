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

  // If the source looks like a remote ref (e.g. "origin/branch"), fetch it
  // to ensure the tracking ref exists locally under refs/remotes/.
  const isRemoteRef = args.source.includes("/")
  if (isRemoteRef) {
    const remoteName = args.source.substring(0, args.source.indexOf("/"))
    const remoteBranch = args.source.substring(args.source.indexOf("/") + 1)
    await gitService.fetchBranch(remoteName, remoteBranch)
  }

  const allBranches = await gitService.listBranches(config.showRemoteBranches || isRemoteRef)
  // When the source is a remote ref (e.g. "origin/feat/foo"), also match
  // against the local counterpart ("feat/foo") since listBranches deduplicates
  // remote branches that have a local counterpart.
  const strippedSource = isRemoteRef ? args.source.replace(/^[^/]+\//, "") : null
  const sourceBranchInfo = allBranches.find(
    (b) => b.name === args.source || (strippedSource && b.name === strippedSource)
  )
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

  // If the worktree already exists, just print the path and exit successfully.
  if (await gitService.worktreeExists(worktreePath)) {
    console.log(worktreePath)
    return
  }

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
