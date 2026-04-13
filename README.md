# ai-git-tool

A TypeScript CLI that uses the Groq API to automatically generate commit messages and PR descriptions from staged diffs.

## Setup

```bash
npm install -g ai-git-tool
```

### Environment Variables

Get your API key from: [Groq Console](https://console.groq.com/keys)

**macOS / Linux (bash/zsh):**

```bash
export GROQ_API_KEY="your_api_key"
```

To persist it, add the line to your `~/.bashrc` or `~/.zshrc`.

**Windows (Command Prompt):**

```cmd
setx GROQ_API_KEY "your_api_key"
```

**Windows (PowerShell):**

```powershell
[System.Environment]::SetEnvironmentVariable("GROQ_API_KEY", "your_api_key", "User")
```

> `setx` / `SetEnvironmentVariable` saves the value as a persistent user environment variable. Restart your terminal after setting it.

**Windows (Git Bash):**

```bash
echo 'export GROQ_API_KEY="your_api_key"' >> ~/.bashrc
source ~/.bashrc
```

You can also set the model (default: `Llama 3.3 70B Versatile`).

```bash
# macOS / Linux / Git Bash
export GROQ_MODEL="llama-3.3-70b-versatile"

# Windows Command Prompt
setx GROQ_MODEL "llama-3.3-70b-versatile"
```

## Usage

### Generate Commit Message

```bash
ai-git commit
```

By default, it runs `git add .` and then generates a commit message.

```bash
# Use only manually staged changes
ai-git commit --no-add
```

You can choose an action in the confirmation prompt.

| Input | Action                               |
| ----- | ------------------------------------ |
| `y`   | Commit as-is                         |
| `n`   | Cancel                               |
| `e`   | Edit in your editor, then commit     |

**Generated commit message format (Conventional Commits):**

```
feat(auth): add Google login

- add GoogleAuthProvider configuration to auth.ts
- add token refresh handling for expired tokens
- add error handling for network failures
```

### Commit and Push

```bash
ai-git push
```

Runs everything in one flow: `git add .` -> AI commit message generation -> commit -> `git push`.

- If upstream is not set, it automatically runs `git push -u origin <branch>`
- Does not create a PR (use `ai-git pr` if you want to create one)

You can choose an action in the confirmation prompt.

| Input | Action                                        |
| ----- | --------------------------------------------- |
| `y`   | Commit and push as-is                         |
| `n`   | Cancel                                        |
| `e`   | Edit in your editor, then commit and push     |

```bash
# Use only staged changes
ai-git push --no-add
```

### Create PR

```bash
ai-git pr
```

It automatically performs the following:

- If the branch has not been pushed yet: `git push -u origin <branch>`
- If there are new local commits: `git push`
- Generates a PR description and creates the PR

You can choose an action in the confirmation prompt.

| Input | Action                                |
| ----- | ------------------------------------- |
| `y`   | Create PR                             |
| `n`   | Cancel                                |
| `e`   | Edit in your editor, then create PR   |

**Generated PR description format:**

```markdown
## Summary

Describe the overall change in 1-2 sentences

## Changes

- Specific changes (3-7 items)

## Test plan

- How to test/verify (2-4 items)
```

**Prerequisites:**

- GitHub CLI (`gh`) is installed ([install guide](https://cli.github.com/))
- Authenticated with `gh auth login`

### Create Branch (Auto Naming)

Generates and creates a branch name from your diffs (staged + unstaged).

```bash
ai-git checkout
```

Naming examples:

```
feat/google-login
fix/api-error-handling
docs/readme-update
```

### Language Settings

The default language is Japanese.

```bash
# Generate in English for this run only
ai-git commit --lang en
ai-git pr --lang en

# Persist default language
ai-git --set-lang en
ai-git --set-lang ja
```

### Help

```bash
ai-git --help
```

## Development

```bash
npm install
npm run build
npm link   # Makes ai-git available in any Git repository
```

```bash
npm run dev
```

## Troubleshooting

### About Error Messages

ai-git shows beginner-friendly error messages for Git users. When an error happens, it explains:

- **What happened** (error details)
- **Why it happened** (root cause)
- **How to fix it** (solution)
- **Which ai-git command to run next** (next step)

### Common Errors and Fixes

| Error                                          | Cause                                           | Fix                                                                 |
| ---------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| `No staged changes found`                      | Nothing to commit is in the staging area        | Stage with `git add .`, or use `ai-git push`                       |
| `GROQ_API_KEY is not set`                      | API key required for AI features is missing     | Get and set your API key from [Groq Console](https://console.groq.com/keys) |
| `This is not a Git repository`                 | Running in a directory without Git initialized  | Run `git init`, or move to a Git repository                        |
| `GitHub CLI (gh) is not installed`             | `gh` command required for PR creation is missing | Install [GitHub CLI](https://cli.github.com/)                      |
| `GitHub CLI authentication is required`        | Not logged in to GitHub with `gh`               | Authenticate with `gh auth login`                                  |
| `Could not detect base branch`                 | `main`/`master`/`develop` does not exist        | Fetch remotes: `git fetch origin`                                  |
| `413 Request too large` / TPM limit exceeded   | Diff is too large, or rate limit exceeded       | It retries with a reduced payload; if it still fails, wait and retry |

### Basic Git Commands

Before using ai-git, it is helpful to know these basic Git commands:

```bash
# Check current status
git status

# Stage changes
git add <filename>    # Specific file only
git add .             # All changes

# Check commit history
git log --oneline

# Check branches
git branch -a

# Check remotes
git remote -v
```

### Recommended Workflow

If you are new to Git, this flow works well:

1. **Make changes** - Edit files
2. **Check status** - Review changes with `git status`
3. **Commit** - Run `ai-git commit` or `ai-git push`
4. **Create PR** - Run `ai-git pr` when needed
