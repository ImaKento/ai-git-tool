#!/usr/bin/env node
import { execSync, spawnSync } from "child_process";
import * as readline from "readline";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

type Language = "ja" | "en";

// ── フラグ解析 ──────────────────────────────────────────
const args = process.argv.slice(2);

// サブコマンドの抽出
const subcommand = args[0];
const subcommandArgs = args.slice(1);

const showHelp =
  args.includes("--help") || args.includes("-h") || subcommand === "help";
const setLangArg = getOptionValue(args, "--set-lang");

// --set-lang は特別扱い（サブコマンド不要）
if (setLangArg) {
  const nextLang = parseLanguage(setLangArg);
  if (!nextLang) {
    console.error("Error: --set-lang は ja または en を指定してください。");
    process.exit(1);
  }
  saveConfig({ language: nextLang });
  console.log(`✅ デフォルト言語を '${nextLang}' に保存しました。`);
  process.exit(0);
}

// サブコマンド固有のフラグ
const short = subcommandArgs.includes("--short");
const langArg = getOptionValue(subcommandArgs, "--lang");

const CONFIG_DIR = path.join(os.homedir(), ".ai-commit");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

if (showHelp) {
  console.log(`
Usage: ai-git <command> [options]

Commands:
  commit            Generate commit message from staged changes
  pr                Generate PR description and create pull request

Commit Options:
  --short           Generate a short one-line commit message
  --lang <ja|en>    Set language for this run

PR Options:
  --lang <ja|en>    Set language for this run

Global Options:
  --set-lang <ja|en> Persist default language
  --help, -h        Show this help message

Environment:
  GEMINI_API_KEY   Your Google Gemini API key (required)

Examples:
  ai-git commit
  ai-git commit --short --lang en
  ai-git pr
  ai-git pr --lang en
  ai-git --set-lang ja
`);
  process.exit(0);
}

// サブコマンドの検証
if (!subcommand || (subcommand !== "commit" && subcommand !== "pr")) {
  console.error("Error: Please specify a command: 'commit' or 'pr'");
  console.error("Run 'ai-git --help' for usage information");
  process.exit(1);
}

// commit サブコマンド固有のバリデーション
if (subcommand === "commit" && short && subcommandArgs.length > 2) {
  // 追加のバリデーションが必要な場合
}

// pr サブコマンドでは --short は使えない
if (subcommand === "pr" && short) {
  console.error("Error: --short cannot be used with 'pr' command");
  process.exit(1);
}

const language = resolveLanguage(langArg);

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
    console.error("❌ GEMINI_API_KEY が未設定です。");
    console.error(
      '   取得先: https://aistudio.google.com/apikey\n   例: export GEMINI_API_KEY="your_api_key"',
    );
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = buildPrompt(diff, short, language);

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    handleGeminiError(error);
    process.exit(1);
  }
}

function buildPrompt(diff: string, useShort: boolean, lang: Language): string {
  if (useShort) {
    if (lang === "ja") {
      return `あなたは git のコミットメッセージ作成の専門家です。
次の git diff から、Conventional Commits 形式の1行コミットメッセージを生成してください。

ルール:
- 形式: <type>(<optional scope>): <short description>
- type: feat, fix, docs, style, refactor, test, chore
- 72文字以内
- 命令形を使う（「追加した」ではなく「追加する」）
- 文末に句点を付けない
- 出力はコミットメッセージ本文のみ（説明文は不要）
- 説明文は日本語にする

Git diff:
${diff}`;
    }

    return `You are an expert at writing git commit messages.
Generate a single commit message in Conventional Commits format for the following git diff.

Rules:
- Format: <type>(<optional scope>): <short description>
- Types: feat, fix, docs, style, refactor, test, chore
- Max 72 characters
- Use imperative mood ("add" not "added")
- No period at the end
- Output ONLY the commit message, nothing else

Git diff:
${diff}`;
  }

  if (lang === "ja") {
    return `あなたは git のコミットメッセージ作成の専門家です。
次の git diff から、Conventional Commits 形式の詳細コミットメッセージを生成してください。

ルール:
- 1行目: <type>(<optional scope>): <short description>（72文字以内）
- 2行目は空行
- 本文は "- " で始まる箇条書き
- 箇条書きは 3-5 行
- WHAT と WHY を書き、HOW は書かない
- 命令形を使う
- 出力はコミットメッセージ本文のみ（説明文は不要）
- 説明文は日本語にする

出力例:
feat(auth): Google ログインを追加する

- auth.ts に GoogleAuthProvider の設定を追加する
- トークン期限切れ時の更新処理を追加する
- ネットワーク障害時のエラーハンドリングを追加する

Git diff:
${diff}`;
  }

  return `You are an expert at writing git commit messages.
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
  if (subcommand === "pr") {
    return mainPR();
  }

  // subcommand === "commit"
  const diff = getStagedDiff();

  if (!diff.trim()) {
    console.log("No staged changes found. Run `git add` first.");
    process.exit(1);
  }

  console.log("🤖 コミットメッセージを生成中...");

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
  console.error("❌ 予期しないエラー:", err.message);
  process.exit(1);
});

function getOptionValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx === -1) {
    return undefined;
  }
  return argv[idx + 1];
}

function parseLanguage(value?: string): Language | null {
  if (!value) {
    return null;
  }
  if (value === "ja" || value === "en") {
    return value;
  }
  return null;
}

function resolveLanguage(langValue?: string): Language {
  const fromFlag = parseLanguage(langValue);
  if (langValue && !fromFlag) {
    console.error("Error: --lang は ja または en を指定してください。");
    process.exit(1);
  }
  if (fromFlag) {
    return fromFlag;
  }

  const config = loadConfig();
  return config?.language ?? "ja";
}

function loadConfig(): { language?: Language } | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { language?: string };
    const lang = parseLanguage(parsed.language);
    if (!lang) {
      return null;
    }
    return { language: lang };
  } catch {
    return null;
  }
}

function saveConfig(config: { language: Language }): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    CONFIG_PATH,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf-8",
  );
}

function handleGeminiError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate")
  ) {
    console.error(
      "❌ Gemini API の利用上限に達しました（429: quota/rate limit）。",
    );
    console.error("   - 少し待って再実行してください");
    console.error(
      "   - Google AI Studio / GCP で請求設定と利用枠を確認してください",
    );
    console.error("   - 必要なら別プロジェクトの API キーを利用してください");
    return;
  }

  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("api key")
  ) {
    console.error(
      "❌ Gemini API 認証エラーです。GEMINI_API_KEY を確認してください。",
    );
    console.error("   取得先: https://aistudio.google.com/apikey");
    return;
  }

  console.error("❌ Gemini API 呼び出しに失敗しました。");
  console.error(`   詳細: ${message}`);
}

// ── PR生成用の関数群 ─────────────────────────────────────

function checkGHCLI(): void {
  try {
    execSync("gh --version", { encoding: "utf-8", stdio: "pipe" });
  } catch {
    if (language === "ja") {
      console.error("❌ GitHub CLI (gh) がインストールされていません。");
      console.error("   インストール: https://cli.github.com/");
    } else {
      console.error("❌ GitHub CLI (gh) is not installed.");
      console.error("   Install from: https://cli.github.com/");
    }
    process.exit(1);
  }
}

function detectBaseBranch(): string {
  // Try 1: Get default branch from remote
  try {
    const result = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    // Parse "refs/remotes/origin/main" -> "main"
    return result.replace("refs/remotes/origin/", "");
  } catch {
    // Fallback: Try common branch names
  }

  // Try 2: Check for common base branches
  for (const branch of ["main", "master", "develop"]) {
    try {
      execSync(`git rev-parse --verify ${branch}`, { stdio: "pipe" });
      return branch;
    } catch {
      continue;
    }
  }

  // Error: No base branch found
  if (language === "ja") {
    console.error("❌ ベースブランチを検出できませんでした。");
    console.error("   main, master, develop のいずれも存在しません。");
  } else {
    console.error("❌ Could not detect base branch.");
    console.error("   None of main, master, develop exist.");
  }
  process.exit(1);
}

function getBranchDiff(baseBranch: string): { commits: string; diff: string } {
  try {
    const commits = execSync(
      `git log ${baseBranch}..HEAD --format="%h %s%n%b%n---"`,
      { encoding: "utf-8" },
    );

    const diff = execSync(`git diff ${baseBranch}...HEAD`, {
      encoding: "utf-8",
    });

    return { commits, diff };
  } catch (error) {
    if (language === "ja") {
      console.error("❌ ブランチの差分取得に失敗しました。");
    } else {
      console.error("❌ Failed to get branch diff.");
    }
    process.exit(1);
  }
}

function buildPRPrompt(commits: string, diff: string, lang: Language): string {
  if (lang === "ja") {
    return `あなたは GitHub の Pull Request 作成の専門家です。
次のコミット履歴と差分から、PR の説明文を生成してください。

ルール:
- GitHub の標準フォーマットを使用する
- ## Summary: 2-3文で変更の概要を説明
- ## Changes: "- " で始まる箇条書き（3-7個）で具体的な変更内容
- ## Test plan: テスト方法の箇条書き（2-4個）
- 命令形を使う
- WHATとWHYを重視し、HOWは最小限に
- 出力はPR説明文のみ（余計な説明は不要）

コミット履歴:
${commits}

変更差分:
${diff}`;
  }

  return `You are an expert at writing GitHub Pull Request descriptions.
Generate a PR description from the following commit history and diff.

Rules:
- Use standard GitHub format
- ## Summary: 2-3 sentences explaining the overall change
- ## Changes: bullet points (3-7 items) with "- " prefix detailing specific changes
- ## Test plan: bullet points (2-4 items) describing how to test
- Use imperative mood
- Focus on WHAT and WHY, minimize HOW
- Output ONLY the PR description, no extra explanation

Commit history:
${commits}

Diff:
${diff}`;
}

async function generatePRDescription(baseBranch: string): Promise<string> {
  const { commits, diff } = getBranchDiff(baseBranch);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY が未設定です。");
    console.error(
      '   取得先: https://aistudio.google.com/apikey\n   例: export GEMINI_API_KEY="your_api_key"',
    );
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = buildPRPrompt(commits, diff, language);

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    handleGeminiError(error);
    process.exit(1);
  }
}

function createPR(description: string, baseBranch: string): void {
  // Extract title from first non-header line
  const lines = description.split("\n");
  const titleLine =
    lines.find((l) => l.trim() && !l.startsWith("#")) || "Pull Request";

  const result = spawnSync(
    "gh",
    [
      "pr",
      "create",
      "--base",
      baseBranch,
      "--title",
      titleLine.trim(),
      "--body",
      description,
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    if (language === "ja") {
      console.error("❌ PR の作成に失敗しました。");
    } else {
      console.error("❌ Failed to create PR.");
    }
    process.exit(1);
  }
}

async function mainPR() {
  checkGHCLI();

  const baseBranch = detectBaseBranch();
  const currentBranch = execSync("git branch --show-current", {
    encoding: "utf-8",
  }).trim();

  if (currentBranch === baseBranch) {
    if (language === "ja") {
      console.error(
        `❌ ベースブランチ (${baseBranch}) からPRを作成できません。`,
      );
    } else {
      console.error(`❌ Cannot create PR from base branch (${baseBranch}).`);
    }
    process.exit(1);
  }

  // ブランチが push されているかチェック、されていなければ自動 push
  try {
    // upstream が設定されているかチェック
    execSync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    // upstream が存在する場合、リモートと同期しているかチェック
    const localCommit = execSync(`git rev-parse ${currentBranch}`, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    const remoteCommit = execSync(
      `git rev-parse ${currentBranch}@{upstream}`,
      { encoding: "utf-8", stdio: "pipe" },
    ).trim();

    if (localCommit !== remoteCommit) {
      // ローカルに新しいコミットがある場合は push
      console.log(`📤 ブランチを push 中... (origin ${currentBranch})`);
      const pushResult = spawnSync("git", ["push"], { stdio: "inherit" });
      if (pushResult.status !== 0) {
        console.error("❌ ブランチの push に失敗しました。");
        process.exit(1);
      }
    }
  } catch {
    // upstream が存在しない場合、新規 push
    console.log(
      `📤 ブランチを push 中... (origin ${currentBranch} を新規作成)`,
    );
    const pushResult = spawnSync(
      "git",
      ["push", "-u", "origin", currentBranch],
      { stdio: "inherit" },
    );
    if (pushResult.status !== 0) {
      if (language === "ja") {
        console.error("❌ ブランチの push に失敗しました。");
      } else {
        console.error("❌ Failed to push branch.");
      }
      process.exit(1);
    }
  }

  console.log(`🤖 PR説明文を生成中... (${baseBranch}...${currentBranch})`);

  const description = await generatePRDescription(baseBranch);

  console.log(`\n📝 Generated PR description:\n`);
  description.split("\n").forEach((line) => {
    console.log(`  ${line}`);
  });
  console.log();

  const answer = await askUser(
    "Create PR with this description? [y/n/e(edit)]: ",
  );

  let finalDescription = description;

  if (answer === "e" || answer === "edit") {
    finalDescription = editInEditor(description);
    if (!finalDescription) {
      console.log("Aborted: empty description.");
      process.exit(0);
    }
    console.log(`\n✏️  Edited description:\n`);
    finalDescription.split("\n").forEach((line) => {
      console.log(`  ${line}`);
    });
    console.log();
  } else if (answer !== "y" && answer !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  createPR(finalDescription, baseBranch);
  console.log(`\n✅ PR created successfully!`);
}
