# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Tool Does

`ai-git` is a TypeScript CLI tool that uses the Groq API (via OpenAI-compatible SDK) to generate git commit messages, PR descriptions, and branch names. It supports Japanese (default) and English output.

## Commands

```bash
npm run build        # Compile TypeScript → dist/
npm run dev          # Run directly with tsx (no compile step)
npm run release:patch|minor|major  # Bump version and push tags
npm link             # Install ai-git globally for local testing
```

No test framework is configured — there are no tests.

## Architecture

Three-layer structure: **commands → services → utils**

**Entry point**: [src/index.ts](src/index.ts) — parses CLI args and routes to a command.

**Commands** ([src/commands/](src/commands/)) — one file per subcommand:
- `commit.ts` — stage files, generate message, open editor, commit
- `push.ts` — commit + push in one flow
- `pr.ts` — generate PR body, invoke GitHub CLI to create PR
- `checkout.ts` — AI-generated branch name, create or switch branch

**Services** ([src/services/](src/services/)):
- `ai.ts` — all Groq API calls; generates commit messages, PR descriptions, branch names. Uses `llama-3.3-70b-versatile` at temperature 0.2. Contains separate prompt strings per language.
- `github.ts` — thin wrapper around `gh` CLI for PR operations
- `branch.ts` — branch name validation and heuristic fallback generation

**Utils** ([src/utils/](src/utils/)):
- `git.ts` — all `execSync`/`spawnSync` git calls (diff, stage, commit, push)
- `errors.ts` — structured user-facing error messages with title/reason/solutions
- `config.ts` — reads/writes `~/.ai-commit/config.json` (stores language preference)
- `ui.ts` — interactive prompts and editor invocation
- `text.ts` — text parsing helpers

## Key Implementation Details

**Large diff handling**: `ai.ts` auto-truncates diffs before sending to the API and retries with a smaller limit on 413/rate-limit errors. Thresholds are hardcoded constants (commit diff max: 3500 chars, PR diff max: 3500 chars).

**Error messages**: All user-facing errors go through `utils/errors.ts` which formats them as title → reason → solutions → next steps, in both languages.

**Git execution**: Interactive operations (commit, push, checkout) use `spawnSync` to inherit stdio. Non-interactive reads use `execSync`.

**External dependencies**: Requires `GROQ_API_KEY` env var, `git`, and `gh` CLI (for PR commands).

**Language**: Japanese is the default. Controlled by `--lang` flag or `ai-git --set-lang ja|en`, persisted in `~/.ai-commit/config.json`.

**Conventional Commits**: Commit messages follow `type(scope): description` format. The AI prompt explicitly instructs WHAT/WHY, not HOW.
