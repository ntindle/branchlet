# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Branchlet is an interactive CLI tool for managing Git worktrees, built with React/Ink for terminal UI. It automates worktree creation with file copying, post-create commands, and editor launching.

## Commands

```bash
# Development
bun run dev              # Run directly with Bun (no build)
bun run build            # Typecheck + bundle to dist/ (ESM, Node target)
bun run start            # Run compiled dist/index.js

# Testing (Bun test runner, 30s timeout)
bun test tests/          # Run all tests
bun test tests/utils/    # Run tests in a directory
bun test tests/utils/path-utils.test.ts  # Run a single test file
bun test tests/ --watch  # Watch mode

# Linting & Formatting (Biome)
bun run lint             # Lint src/
bun run format           # Format src/ with --write
bun run check            # Lint + format with --write

# Type checking
bun run typecheck        # tsc --noEmit

# Full CI pipeline
bun run ci               # typecheck → lint → test → build
```

## Architecture

**Service-oriented architecture with React/Ink UI layer:**

- `src/index.tsx` — CLI entry point; parses args (`minimist`), renders Ink `<App>`
- `src/components/app.tsx` — Root component; initializes services, manages app state/mode
- `src/components/app-router.tsx` — Routes between modes: `menu | create | list | delete | settings`

**Services** (`src/services/`) — Business logic, no UI:
- `worktree-service.ts` — Orchestrator: coordinates git ops, file copying, post-create commands
- `git-service.ts` — All git operations via child process (`spawn`), parses porcelain output
- `config-service.ts` — Loads/saves config; searches `.branchlet.json` (project) → `~/.branchlet/settings.json` (global); validates with Zod
- `file-service.ts` — Glob-based file copying, command execution, terminal spawning

**Panels** (`src/panels/`) — Feature screens (create, list, delete, settings, main menu), each a multi-step flow with its own state management.

**Common components** (`src/components/common/`) — Reusable UI: `SelectPrompt`, `InputPrompt`, `ConfirmDialog`, `StatusIndicator`, `CommandProgress`.

**Supporting layers:**
- `src/types/` — TypeScript interfaces (`GitWorktree`, `GitBranch`, `WorktreeConfig`, `AppMode`)
- `src/schemas/` — Zod schemas for config validation
- `src/utils/` — Git command execution, path templates, glob matching, error classes
- `src/constants/` — Default config values, UI messages/colors

## Key Conventions

- **Biome** for linting and formatting: 2-space indent, 100-char lines, double quotes, no semicolons
- **Strict TypeScript**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled
- **File naming**: kebab-case for all files
- **Tests** mirror `src/` structure under `tests/`; use Bun's built-in test runner
- **Build**: Bun bundles `src/index.tsx` → `dist/index.js` as ESM with `yoga-wasm-web` externalized
- **Node >=20** required
