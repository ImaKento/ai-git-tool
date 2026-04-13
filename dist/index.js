#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const openai_1 = __importDefault(require("openai"));
// ── フラグ解析 ──────────────────────────────────────────
const args = process.argv.slice(2);
const subcommand = args[0];
const subcommandArgs = args.slice(1);
const showHelp = args.includes("--help") || args.includes("-h") || subcommand === "help";
const setLangArg = getOptionValue(args, "--set-lang");
const langArg = getOptionValue(subcommandArgs, "--lang");
const CONFIG_DIR = path.join(os.homedir(), ".ai-commit");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const defaultGroqModel = "llama-3.1-8b-instant";
const COMMIT_DIFF_COMPACT_CHARS = 3500;
const PR_COMMITS_COMPACT_CHARS = 1800;
const PR_DIFF_COMPACT_CHARS = 3500;
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
if (showHelp) {
    console.log(`
Usage: ai-git <command> [options]

Commands:
  commit            Generate commit message from staged changes
  pr                Generate PR description and create pull request

Commit Options:
  --lang <ja|en>    Set language for this run

PR Options:
  --lang <ja|en>    Set language for this run

Global Options:
  --set-lang <ja|en> Persist default language
  --help, -h        Show this help message

Environment:
  GROQ_API_KEY     Your Groq API key (required)
  GROQ_MODEL       Optional model name (default: llama-3.1-8b-instant)
`);
    process.exit(0);
}
if (!subcommand || (subcommand !== "commit" && subcommand !== "pr")) {
    console.error("Error: Please specify a command: 'commit' or 'pr'");
    console.error("Run 'ai-git --help' for usage information");
    process.exit(1);
}
const language = resolveLanguage(langArg);
// ── git diff 取得 ────────────────────────────────────────
function getStagedDiff() {
    try {
        return (0, child_process_1.execSync)("git diff --cached", { encoding: "utf-8" });
    }
    catch {
        console.error("Error: Failed to run git diff --cached");
        process.exit(1);
    }
}
// ── Groq APIでコミットメッセージ生成 ───────────────────
async function generateCommitMessage(diff) {
    const inputDiff = truncateByChars(diff, COMMIT_DIFF_COMPACT_CHARS);
    const prompt = buildPrompt(inputDiff, language);
    try {
        return await generateText(prompt);
    }
    catch (error) {
        if (isRequestTooLargeError(error)) {
            const smallerDiff = truncateByChars(diff, 1800);
            return generateText(buildPrompt(smallerDiff, language));
        }
        handleGroqError(error);
        process.exit(1);
    }
}
function buildPrompt(diff, lang) {
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
function askUser(question) {
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
function editInEditor(message) {
    const tmpFile = path.join(os.tmpdir(), `commit-msg-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, message, "utf-8");
    const editor = process.env.EDITOR || "vi";
    const result = (0, child_process_1.spawnSync)(editor, [tmpFile], { stdio: "inherit" });
    if (result.error) {
        console.error(`Error: Failed to open editor: ${result.error.message}`);
        process.exit(1);
    }
    const edited = fs.readFileSync(tmpFile, "utf-8").trim();
    fs.unlinkSync(tmpFile);
    return edited;
}
// ── git commit 実行 ──────────────────────────────────────
function doCommit(message) {
    const result = (0, child_process_1.spawnSync)("git", ["commit", "-m", message], {
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
        await mainPR();
        return;
    }
    const diff = getStagedDiff();
    if (!diff.trim()) {
        console.log("No staged changes found. Run `git add` first.");
        process.exit(1);
    }
    console.log("🤖 コミットメッセージを生成中... (compact summary input)");
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
    }
    else if (answer !== "y" && answer !== "yes") {
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
function getOptionValue(argv, name) {
    const idx = argv.indexOf(name);
    if (idx === -1) {
        return undefined;
    }
    return argv[idx + 1];
}
function parseLanguage(value) {
    if (!value) {
        return null;
    }
    if (value === "ja" || value === "en") {
        return value;
    }
    return null;
}
function resolveLanguage(langValue) {
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
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            return null;
        }
        const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        const lang = parseLanguage(parsed.language);
        if (!lang) {
            return null;
        }
        return { language: lang };
    }
    catch {
        return null;
    }
}
function saveConfig(config) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}
function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error("❌ GROQ_API_KEY が未設定です。");
        console.error('   取得先: https://console.groq.com/keys\n   例: export GROQ_API_KEY="your_api_key"');
        process.exit(1);
    }
    return new openai_1.default({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
    });
}
async function generateText(prompt) {
    const client = getGroqClient();
    const model = process.env.GROQ_MODEL || defaultGroqModel;
    const res = await client.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0]?.message?.content?.trim() || "";
}
function handleGroqError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes("429") ||
        lower.includes("quota") ||
        lower.includes("rate")) {
        console.error("❌ Groq API の利用上限に達しました（429: quota/rate limit）。");
        console.error("   - 少し待って再実行してください");
        console.error("   - https://console.groq.com で利用枠を確認してください");
        console.error("   - 必要なら別プロジェクトの API キーを利用してください");
        return;
    }
    if (lower.includes("401") ||
        lower.includes("403") ||
        lower.includes("api key")) {
        console.error("❌ Groq API 認証エラーです。GROQ_API_KEY を確認してください。");
        console.error("   取得先: https://console.groq.com/keys");
        return;
    }
    console.error("❌ Groq API 呼び出しに失敗しました。");
    console.error(`   詳細: ${message}`);
}
// ── PR生成用の関数群 ─────────────────────────────────────
function checkGHCLI() {
    try {
        (0, child_process_1.execSync)("gh --version", { encoding: "utf-8", stdio: "pipe" });
    }
    catch {
        if (language === "ja") {
            console.error("❌ GitHub CLI (gh) がインストールされていません。");
            console.error("   インストール: https://cli.github.com/");
        }
        else {
            console.error("❌ GitHub CLI (gh) is not installed.");
            console.error("   Install from: https://cli.github.com/");
        }
        process.exit(1);
    }
}
function checkGHAuth() {
    if (process.env.GH_TOKEN) {
        return;
    }
    try {
        (0, child_process_1.execSync)("gh auth status", { encoding: "utf-8", stdio: "pipe" });
    }
    catch {
        if (language === "ja") {
            console.error("❌ GitHub CLI の認証が必要です。");
            console.error("   次を実行してください: gh auth login");
            console.error("   もしくは GH_TOKEN を環境変数に設定してください。");
        }
        else {
            console.error("❌ GitHub CLI authentication is required.");
            console.error("   Run: gh auth login");
            console.error("   Or set GH_TOKEN environment variable.");
        }
        process.exit(1);
    }
}
function getPullRequestURL(branch) {
    try {
        const remoteUrl = (0, child_process_1.execSync)("git remote get-url origin", {
            encoding: "utf-8",
            stdio: "pipe",
        }).trim();
        const repoPath = parseGitHubRepoPath(remoteUrl);
        if (!repoPath) {
            return null;
        }
        return `https://github.com/${repoPath}/pull/new/${branch}`;
    }
    catch {
        return null;
    }
}
function parseGitHubRepoPath(remoteUrl) {
    const normalized = remoteUrl.replace(/\.git$/, "");
    const sshMatch = normalized.match(/^git@github\.com:(.+\/.+)$/);
    if (sshMatch) {
        return sshMatch[1];
    }
    const httpsMatch = normalized.match(/^https:\/\/github\.com\/(.+\/.+)$/);
    if (httpsMatch) {
        return httpsMatch[1];
    }
    return null;
}
function detectBaseBranch() {
    // Try 1: Get default branch from remote
    try {
        const result = (0, child_process_1.execSync)("git symbolic-ref refs/remotes/origin/HEAD", {
            encoding: "utf-8",
            stdio: "pipe",
        }).trim();
        // Parse "refs/remotes/origin/main" -> "main"
        return result.replace("refs/remotes/origin/", "");
    }
    catch {
        // Fallback: Try common branch names
    }
    // Try 2: Check for common base branches
    for (const branch of ["main", "master", "develop"]) {
        try {
            (0, child_process_1.execSync)(`git rev-parse --verify ${branch}`, { stdio: "pipe" });
            return branch;
        }
        catch {
            continue;
        }
    }
    // Error: No base branch found
    if (language === "ja") {
        console.error("❌ ベースブランチを検出できませんでした。");
        console.error("   main, master, develop のいずれも存在しません。");
    }
    else {
        console.error("❌ Could not detect base branch.");
        console.error("   None of main, master, develop exist.");
    }
    process.exit(1);
}
function getBranchDiff(baseBranch) {
    try {
        const commits = (0, child_process_1.execSync)(`git log ${baseBranch}..HEAD --format="%h %s%n%b%n---"`, { encoding: "utf-8" });
        const diff = (0, child_process_1.execSync)(`git diff ${baseBranch}...HEAD`, {
            encoding: "utf-8",
        });
        return { commits, diff };
    }
    catch {
        if (language === "ja") {
            console.error("❌ ブランチの差分取得に失敗しました。");
        }
        else {
            console.error("❌ Failed to get branch diff.");
        }
        process.exit(1);
    }
}
function buildPRPrompt(commits, diff, lang) {
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
async function generatePRDescription(baseBranch) {
    const { commits, diff } = getBranchDiff(baseBranch);
    const inputCommits = truncateByChars(commits, PR_COMMITS_COMPACT_CHARS);
    const inputDiff = truncateByChars(diff, PR_DIFF_COMPACT_CHARS);
    const prompt = buildPRPrompt(inputCommits, inputDiff, language);
    try {
        return await generateText(prompt);
    }
    catch (error) {
        if (isRequestTooLargeError(error)) {
            const compactCommits = truncateByChars(commits, 1200);
            const compactDiff = truncateByChars(diff, 2200);
            const compactPrompt = buildPRPrompt(compactCommits, compactDiff, language);
            if (language === "ja") {
                console.log("ℹ️ 入力サイズが大きいため、差分を要約モードにして再試行します...");
            }
            else {
                console.log("ℹ️ Input is too large. Retrying with compact diff summary...");
            }
            try {
                return await generateText(compactPrompt);
            }
            catch (retryError) {
                handleGroqError(retryError);
                process.exit(1);
            }
        }
        handleGroqError(error);
        process.exit(1);
    }
}
function truncateByChars(input, maxChars) {
    if (input.length <= maxChars) {
        return input;
    }
    return `${input.slice(0, maxChars)}\n\n... (truncated)`;
}
function isRequestTooLargeError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    return (lower.includes("413") ||
        lower.includes("request too large") ||
        lower.includes("tokens per minute") ||
        lower.includes("tpm"));
}
function createPR(description, baseBranch, fallbackURL) {
    // Extract title from first non-header line
    const lines = description.split("\n");
    const titleLine = lines.find((l) => l.trim() && !l.startsWith("#")) || "Pull Request";
    const result = (0, child_process_1.spawnSync)("gh", [
        "pr",
        "create",
        "--base",
        baseBranch,
        "--title",
        titleLine.trim(),
        "--body",
        description,
    ], { encoding: "utf-8", stdio: "pipe" });
    if (result.stdout) {
        process.stdout.write(result.stdout);
    }
    if (result.stderr) {
        process.stderr.write(result.stderr);
    }
    if (result.status !== 0) {
        if (language === "ja") {
            console.error("❌ PR の作成に失敗しました。");
            if (fallbackURL) {
                console.error(`   手動で作成する場合: ${fallbackURL}`);
            }
        }
        else {
            console.error("❌ Failed to create PR.");
            if (fallbackURL) {
                console.error(`   Create manually: ${fallbackURL}`);
            }
        }
        process.exit(1);
    }
}
async function mainPR() {
    checkGHCLI();
    checkGHAuth();
    const baseBranch = detectBaseBranch();
    const currentBranch = (0, child_process_1.execSync)("git branch --show-current", {
        encoding: "utf-8",
    }).trim();
    if (currentBranch === baseBranch) {
        if (language === "ja") {
            console.error(`❌ ベースブランチ (${baseBranch}) からPRを作成できません。`);
        }
        else {
            console.error(`❌ Cannot create PR from base branch (${baseBranch}).`);
        }
        process.exit(1);
    }
    // ブランチが push されているかチェック、されていなければ自動 push
    try {
        // upstream が設定されているかチェック
        (0, child_process_1.execSync)(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, {
            encoding: "utf-8",
            stdio: "pipe",
        });
        // upstream が存在する場合、リモートと同期しているかチェック
        const localCommit = (0, child_process_1.execSync)(`git rev-parse ${currentBranch}`, {
            encoding: "utf-8",
            stdio: "pipe",
        }).trim();
        const remoteCommit = (0, child_process_1.execSync)(`git rev-parse ${currentBranch}@{upstream}`, { encoding: "utf-8", stdio: "pipe" }).trim();
        if (localCommit !== remoteCommit) {
            // ローカルに新しいコミットがある場合は push
            console.log(`📤 ブランチを push 中... (origin ${currentBranch})`);
            const pushResult = (0, child_process_1.spawnSync)("git", ["push"], { stdio: "inherit" });
            if (pushResult.status !== 0) {
                console.error("❌ ブランチの push に失敗しました。");
                process.exit(1);
            }
        }
    }
    catch {
        // upstream が存在しない場合、新規 push
        console.log(`📤 ブランチを push 中... (origin ${currentBranch} を新規作成)`);
        const pushResult = (0, child_process_1.spawnSync)("git", ["push", "-u", "origin", currentBranch], { stdio: "inherit" });
        if (pushResult.status !== 0) {
            if (language === "ja") {
                console.error("❌ ブランチの push に失敗しました。");
            }
            else {
                console.error("❌ Failed to push branch.");
            }
            process.exit(1);
        }
    }
    console.log(`🤖 PR説明文を生成中... (${baseBranch}...${currentBranch}) [compact summary input]`);
    const description = await generatePRDescription(baseBranch);
    console.log(`\n📝 Generated PR description:\n`);
    description.split("\n").forEach((line) => {
        console.log(`  ${line}`);
    });
    console.log();
    const answer = await askUser("Create PR with this description? [y/n/e(edit)]: ");
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
    }
    else if (answer !== "y" && answer !== "yes") {
        console.log("Aborted.");
        process.exit(0);
    }
    const fallbackURL = getPullRequestURL(currentBranch);
    createPR(finalDescription, baseBranch, fallbackURL);
    console.log(`\n✅ PR created successfully!`);
}
