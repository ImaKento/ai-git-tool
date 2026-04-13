#!/usr/bin/env node
import { execSync, spawnSync } from "child_process";
import * as readline from "readline";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── フラグ解析 ──────────────────────────────────────────
const args = process.argv.slice(2);
const short = args.includes("--short");
const showHelp = args.includes("--help") || args.includes("-h");

if (showHelp) {
  console.log(`
Usage: ai-commit [options]

Options:
  --short      Generate a short one-line commit message
  --help, -h   Show this help message

Environment:
  GEMINI_API_KEY   Your Google Gemini API key (required)
`);
  process.exit(0);
}

// ── git diff 取得 ────────────────────────────────────────
function getStagedDiff(): string {
  try {
    return execSync("git diff --cached", { encoding: "utf-8" });
  } catch {
    console.error("Error: Failed to run git diff --cached");
    process.exit(1);
  }
}

// ── Gemini APIでコミットメッセージ生成 ───────────────────
async function generateCommitMessage(diff: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set");
    console.error("Get your key at: https://aistudio.google.com/apikey");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = short
    ? `You are an expert at writing git commit messages.
Generate a single commit message in Conventional Commits format for the following git diff.

Rules:
- Format: <type>(<optional scope>): <short description>
- Types: feat, fix, docs, style, refactor, test, chore
- Max 72 characters
- Use imperative mood ("add" not "added")
- No period at the end
- Output ONLY the commit message, nothing else

Git diff:
${diff}`
    : `You are an expert at writing git commit messages.
Generate a detailed commit message in Conventional Commits format for the following git diff.

Rules:
- First line: <type>(<optional scope>): <short description> (max 72 chars)
- Blank line after the first line
- Body: bullet points starting with "- " explaining WHAT and WHY
- 3-5 bullet points max
- Use imperative mood ("add" not "added")
- Output ONLY the commit message, nothing else

Example:
feat(auth): add Google login with Firebase Auth

- Add GoogleAuthProvider setup in auth.ts
- Handle token refresh on expiry
- Add error handling for network failures

Git diff:
${diff}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ── ユーザー確認 ─────────────────────────────────────────
function askUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── エディタで編集 ───────────────────────────────────────
function editInEditor(message: string): string {
  const tmpFile = path.join(os.tmpdir(), `commit-msg-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, message, "utf-8");

  const editor = process.env.EDITOR || "vi";
  const result = spawnSync(editor, [tmpFile], { stdio: "inherit" });

  if (result.error) {
    console.error(`Error: Failed to open editor: ${result.error.message}`);
    process.exit(1);
  }

  const edited = fs.readFileSync(tmpFile, "utf-8").trim();
  fs.unlinkSync(tmpFile);
  return edited;
}

// ── git commit 実行 ──────────────────────────────────────
function doCommit(message: string): void {
  const result = spawnSync("git", ["commit", "-m", message], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error("Error: git commit failed");
    process.exit(1);
  }
}

// ── メイン ───────────────────────────────────────────────
async function main() {
  const diff = getStagedDiff();

  if (!diff.trim()) {
    console.log("No staged changes found. Run `git add` first.");
    process.exit(1);
  }

  console.log(
    short
      ? "🤖 Generating commit message..."
      : "🤖 Generating detailed commit message..."
  );

  const message = await generateCommitMessage(diff);

  console.log(`\n📝 Generated commit message:\n`);
  // 詳細モードは複数行なのでインデントして表示
  message.split("\n").forEach((line) => {
    console.log(`  ${line}`);
  });
  console.log();

  const answer = await askUser("Use this message? [y/n/e(edit)]: ");

  let finalMessage = message;

  if (answer === "e" || answer === "edit") {
    finalMessage = editInEditor(message);
    if (!finalMessage) {
      console.log("Aborted: empty message.");
      process.exit(0);
    }
    console.log(`\n✏️  Edited message:\n`);
    finalMessage.split("\n").forEach((line) => {
      console.log(`  ${line}`);
    });
    console.log();
  } else if (answer !== "y" && answer !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  doCommit(finalMessage);
  console.log(`\n✅ Committed successfully!`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
