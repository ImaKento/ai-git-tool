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
// サブコマンドの抽出
const subcommand = args[0];
const subcommandArgs = args.slice(1);
const showHelp = args.includes("--help") || args.includes("-h") || subcommand === "help";
const setLangArg = getOptionValue(args, "--set-lang");
const langArg = getOptionValue(subcommandArgs, "--lang");
const noAdd = subcommandArgs.includes("--no-add");
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
  push              Commit with AI message and push to remote (git add . + commit + push)
  pr                Generate PR description and create pull request
  checkout          Create branch from current changes

Commit Options:
  --lang <ja|en>    Set language for this run
  --no-add          Skip automatic git add .

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
if (!subcommand ||
    (subcommand !== "commit" &&
        subcommand !== "push" &&
        subcommand !== "pr" &&
        subcommand !== "checkout")) {
    console.error("❌ コマンドが指定されていないか、無効なコマンドです");
    console.error("");
    console.error("📚 利用可能なコマンド:");
    console.error("   ai-git commit   - AI でコミットメッセージを生成してコミット");
    console.error("   ai-git push     - コミット後、リモートにプッシュ");
    console.error("   ai-git pr       - PR の説明を生成して Pull Request を作成");
    console.error("   ai-git checkout - 変更内容から新しいブランチを作成");
    console.error("");
    console.error("💡 詳しい使い方:");
    console.error("   ai-git --help");
    console.error("");
    console.error("🎯 最初に試すなら:");
    console.error("   ai-git commit   (変更をコミット)");
    console.error("   ai-git push     (コミット＆プッシュを一度に実行)");
    process.exit(1);
}
const language = resolveLanguage(langArg);
// ── エラーヘルパー関数 ────────────────────────────────────
/**
 * Git リポジトリかどうかを確認
 */
function checkIfGitRepository() {
    try {
        (0, child_process_1.execSync)("git rev-parse --git-dir", { stdio: "pipe" });
    }
    catch {
        console.error("❌ これは Git リポジトリではありません。");
        console.error("");
        console.error("💡 次の手順を試してください:");
        console.error("   1. Git リポジトリを初期化する:");
        console.error("      git init");
        console.error("   2. または、既存のリポジトリに移動する:");
        console.error("      cd /path/to/your/repository");
        process.exit(1);
    }
}
/**
 * 親切なエラーメッセージを表示
 */
function showFriendlyError(title, reason, solutions, nextSteps) {
    console.error(`❌ ${title}`);
    console.error("");
    console.error(`📋 原因: ${reason}`);
    console.error("");
    console.error("💡 解決方法:");
    solutions.forEach((solution, idx) => {
        console.error(`   ${idx + 1}. ${solution}`);
    });
    if (nextSteps && nextSteps.length > 0) {
        console.error("");
        console.error("🚀 その後、以下のコマンドが使えます:");
        nextSteps.forEach((step) => {
            console.error(`   - ${step}`);
        });
    }
}
// ── git diff 取得 ────────────────────────────────────────
function getStagedDiff() {
    checkIfGitRepository();
    try {
        return (0, child_process_1.execSync)("git diff --cached", { encoding: "utf-8" });
    }
    catch {
        showFriendlyError("Git の差分取得に失敗しました", "git diff コマンドの実行に失敗しました", [
            "Git がインストールされているか確認してください: git --version",
            "カレントディレクトリが Git リポジトリか確認してください: git status",
        ], ["ai-git commit で変更をコミット", "ai-git checkout で新しいブランチを作成"]);
        process.exit(1);
    }
}
// ── AI によるメッセージ生成 ───────────────────────────────
/**
 * git diff から AI を使ってコミットメッセージを生成
 * リクエストが大きすぎる場合は自動的に縮小して再試行
 */
async function generateCommitMessage(diff) {
    const inputDiff = truncateByChars(diff, COMMIT_DIFF_COMPACT_CHARS);
    const prompt = buildPrompt(inputDiff, language);
    try {
        const raw = await generateText(prompt);
        return normalizeGeneratedCommitMessage(raw, diff, language);
    }
    catch (error) {
        if (isRequestTooLargeError(error)) {
            const smallerDiff = truncateByChars(diff, 1800);
            const retryRaw = await generateText(buildPrompt(smallerDiff, language));
            return normalizeGeneratedCommitMessage(retryRaw, diff, language);
        }
        handleGroqError(error);
        process.exit(1);
    }
}
/**
 * AI が生成したコミットメッセージを検証・正規化
 * 不適切な内容の場合はフォールバックメッセージを使用
 */
function normalizeGeneratedCommitMessage(raw, diff, lang) {
    const lines = raw
        .split("\n")
        .map((line) => line.replace(/\s+$/g, ""))
        .filter((_, idx, arr) => !(idx > 0 && arr[idx - 1] === "" && arr[idx] === ""));
    if (lines.length === 0) {
        return buildFallbackCommitMessage(diff, lang);
    }
    const subjectLine = lines[0]?.trim() || "";
    const conventionalMatch = /^[a-z]+(\([^)]+\))?:\s+(.+)$/.exec(subjectLine);
    const hasConventionalPrefix = Boolean(conventionalMatch);
    const shortDescription = conventionalMatch?.[2]?.trim() || subjectLine;
    if (!hasConventionalPrefix ||
        looksLikePathOnly(shortDescription) ||
        shortDescription.length < 8) {
        lines[0] = buildFallbackSubjectLine(diff, lang);
    }
    return lines.join("\n").trim();
}
function looksLikePathOnly(value) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    const hasPathToken = normalized.includes("/") || normalized.includes(".");
    return hasPathToken && /^[a-z0-9/_\-.]+$/.test(normalized);
}
function buildFallbackCommitMessage(diff, lang) {
    const subject = buildFallbackSubjectLine(diff, lang);
    if (lang === "ja") {
        return `${subject}\n\n- 差分の主目的を明確にし、変更理由が伝わる形に整える`;
    }
    return `${subject}\n\n- Clarify the main change intent so the reason is easy to understand`;
}
function buildFallbackSubjectLine(diff, lang) {
    const files = getChangedFiles();
    const type = inferBranchType(files, diff);
    const rawTopic = inferTopic(files, diff);
    const topic = rawTopic ? rawTopic.replace(/-/g, " ") : "";
    if (lang === "ja") {
        const description = topic
            ? `${topic} の変更意図を分かりやすく整理する`
            : "変更意図が伝わるように更新内容を整理する";
        return `${type}: ${description}`;
    }
    const description = topic
        ? `clarify the intent behind ${topic} changes`
        : "clarify update intent in one clear sentence";
    return `${type}: ${description}`;
}
/**
 * コミットメッセージ生成用のプロンプトを構築
 * 言語に応じて日本語または英語のプロンプトを返す
 */
function buildPrompt(diff, lang) {
    if (lang === "ja") {
        return `あなたは git のコミットメッセージ作成の専門家です。
次の git diff を注意深く分析し、Conventional Commits 形式の詳細コミットメッセージを生成してください。

重要: diff の内容を正確に読み取り、実際に何が変更されたかを理解してください。
変更されたファイル名、追加/削除された関数名、変更の目的を特定してください。

ルール:
- 1行目: <type>(<optional scope>): <short description>（72文字以内）
  * type は実際の変更内容に基づいて選択（feat, fix, docs, refactor, test, chore など）
  * scope は変更の影響範囲（例: error-handling, ui, api）
- 2行目は空行
- 本文は "- " で始まる箇条書き
- 箇条書きは 3-5 行で、具体的な変更内容を記述
- WHAT（何を変更したか）と WHY（なぜ変更したか）を書く
- HOW（どうやって実装したか）は書かない
- 命令形を使う（「追加する」「修正する」など）
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
Carefully analyze the following git diff and generate a detailed commit message in Conventional Commits format.

IMPORTANT: Read the diff content accurately and understand what was actually changed.
Identify changed file names, added/removed function names, and the purpose of the changes.

Rules:
- First line: <type>(<optional scope>): <short description> (max 72 chars)
  * Choose type based on actual changes (feat, fix, docs, refactor, test, chore, etc.)
  * Scope should reflect the area of impact (e.g., error-handling, ui, api)
- Blank line after the first line
- Body: bullet points starting with "- " describing specific changes
- 3-5 bullet points explaining WHAT was changed and WHY
- Do NOT explain HOW it was implemented
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
// ── Git 基本操作 ──────────────────────────────────────────
/**
 * 現在のブランチをリモートにプッシュ
 * upstream が未設定の場合は自動で設定
 */
function pushCurrentBranch(currentBranch) {
    try {
        // upstream が設定済みか確認
        (0, child_process_1.execSync)(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, {
            encoding: "utf-8",
            stdio: "pipe",
        });
        console.log(`📤 push 中... (origin ${currentBranch})`);
        const pushResult = (0, child_process_1.spawnSync)("git", ["push"], { stdio: "inherit" });
        if (pushResult.status !== 0) {
            showFriendlyError("プッシュに失敗しました", "リモートへのプッシュが失敗しました（権限不足やネットワークエラーの可能性があります）", [
                "リモートリポジトリの設定を確認: git remote -v",
                "プッシュ権限があるか確認してください",
                "ネットワーク接続を確認してください",
                "リモートブランチとの競合がないか確認: git pull",
            ], [
                "競合を解決後に ai-git push を再実行",
                "ai-git pr で Pull Request を作成（プッシュ済みの場合）",
            ]);
            process.exit(1);
        }
    }
    catch {
        // upstream が存在しない場合、新規 push
        console.log(`📤 push 中... (origin ${currentBranch} を新規作成)`);
        const pushResult = (0, child_process_1.spawnSync)("git", ["push", "-u", "origin", currentBranch], {
            stdio: "inherit",
        });
        if (pushResult.status !== 0) {
            showFriendlyError("新しいブランチのプッシュに失敗しました", "リモートに新しいブランチを作成できませんでした（権限不足やネットワークエラーの可能性があります）", [
                "リモートリポジトリの URL を確認: git remote -v",
                "リモートリポジトリへのプッシュ権限があるか確認",
                "ネットワーク接続を確認してください",
                "SSH キーまたは認証情報が正しく設定されているか確認",
            ], [
                "権限を確認後に ai-git push を再実行",
                "手動でプッシュ: git push -u origin " + currentBranch,
            ]);
            process.exit(1);
        }
    }
}
// ── git commit 実行 ──────────────────────────────────────
function doCommit(message) {
    const result = (0, child_process_1.spawnSync)("git", ["commit", "-m", message], {
        stdio: "inherit",
    });
    if (result.status !== 0) {
        showFriendlyError("コミットに失敗しました", "git commit コマンドが失敗しました（pre-commit フックのエラーや空のコミットの可能性があります）", [
            "ステージされたファイルを確認: git status",
            "pre-commit フックがある場合は、エラー内容を確認してください",
            "空のコミットを許可する場合: git commit --allow-empty -m 'メッセージ'",
        ], ["エラーを修正後に ai-git commit を再実行"]);
        process.exit(1);
    }
}
function stageAllChanges() {
    const result = (0, child_process_1.spawnSync)("git", ["add", "."], { stdio: "inherit" });
    if (result.status !== 0) {
        showFriendlyError("ファイルのステージングに失敗しました", "git add . コマンドが失敗しました", [
            "カレントディレクトリを確認: pwd",
            "Git の状態を確認: git status",
            ".gitignore で除外されているファイルがないか確認",
            "ファイルのパーミッションを確認してください",
        ], [
            "ai-git commit --no-add (手動で git add する場合)",
            "特定のファイルだけ追加: git add <ファイル名>",
        ]);
        process.exit(1);
    }
}
/**
 * checkout サブコマンドのメイン処理
 * 変更内容から適切なブランチ名を AI で提案し、新しいブランチを作成
 */
async function mainCheckout() {
    const suggested = await suggestBranchName();
    const branchName = ensureAvailableBranchName(suggested);
    const result = (0, child_process_1.spawnSync)("git", ["checkout", "-b", branchName], {
        stdio: "inherit",
    });
    if (result.status !== 0) {
        showFriendlyError("ブランチ作成に失敗しました", "git checkout -b コマンドが失敗しました（未コミットの変更がある可能性があります）", [
            "現在の変更を確認: git status",
            "変更をコミットしてから新しいブランチを作成する",
            "変更を一時退避: git stash",
            "または、変更を含めたままブランチを作成: git checkout -b <ブランチ名>",
        ], [
            "ai-git commit でまず変更をコミット",
            "ai-git push でコミット＆プッシュしてから新しいブランチを作成",
        ]);
        process.exit(1);
    }
    console.log(`✅ ブランチを作成しました: ${branchName}`);
}
/**
 * 変更内容からブランチ名を提案
 * AI が利用可能な場合は AI を使用、そうでない場合はヒューリスティックで生成
 */
async function suggestBranchName() {
    const files = getChangedFiles();
    const diff = getCombinedDiff();
    const fromAI = await suggestBranchNameWithAI(files, diff);
    if (fromAI) {
        return fromAI;
    }
    const type = inferBranchType(files, diff);
    const topic = inferTopic(files, diff);
    if (!topic) {
        return `${type}/update-${randomSuffix()}`;
    }
    return `${type}/${topic}`;
}
async function suggestBranchNameWithAI(files, diff) {
    if (!process.env.GROQ_API_KEY) {
        return null;
    }
    const compactFiles = files.slice(0, 30).join("\n");
    const compactDiff = truncateByChars(diff, 2800);
    const prompt = `You are an expert at naming git branches.
Generate exactly one branch name from the following changes.

Rules:
- Output only branch name, nothing else
- Format: <type>/<slug>
- type must be one of: feat, fix, docs, chore, refactor, test, style
- slug must use kebab-case
- Prefer meaningful feature intent over noisy token names
- If changes look like new feature or command addition, prefer feat

Changed files:
${compactFiles}

Diff:
${compactDiff}`;
    try {
        const raw = await generateText(prompt);
        return normalizeBranchCandidate(raw);
    }
    catch {
        return null;
    }
}
function normalizeBranchCandidate(raw) {
    const firstLine = raw.split("\n")[0]?.trim().toLowerCase() || "";
    const cleaned = firstLine.replace(/[`"' ]/g, "");
    const normalized = cleaned.replace(/^feature\//, "feat/");
    const [head, ...tail] = normalized.split("/");
    if (!head || tail.length === 0) {
        return null;
    }
    const validTypes = new Set([
        "feat",
        "fix",
        "docs",
        "chore",
        "refactor",
        "test",
        "style",
    ]);
    if (!validTypes.has(head)) {
        return null;
    }
    const slug = sanitizeBranchPart(tail.join("-"));
    if (!slug || slug.length < 3) {
        return null;
    }
    return `${head}/${slug}`;
}
function getChangedFiles() {
    const staged = getCommandOutput("git diff --cached --name-only");
    const unstaged = getCommandOutput("git diff --name-only");
    const merged = `${staged}\n${unstaged}`
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
    return Array.from(new Set(merged));
}
function getCombinedDiff() {
    const staged = getCommandOutput("git diff --cached");
    const unstaged = getCommandOutput("git diff");
    return `${staged}\n${unstaged}`;
}
function getCommandOutput(command) {
    try {
        return (0, child_process_1.execSync)(command, { encoding: "utf-8", stdio: "pipe" });
    }
    catch {
        return "";
    }
}
function inferBranchType(files, diff) {
    const lowerFiles = files.map((f) => f.toLowerCase());
    const lowerDiff = diff.toLowerCase();
    if (lowerFiles.length > 0 && lowerFiles.every((f) => f.endsWith(".md"))) {
        return "docs";
    }
    if (lowerFiles.some((f) => f.includes("readme") || f.endsWith(".md")) &&
        lowerFiles.length <= 2) {
        return "docs";
    }
    if (lowerFiles.some((f) => f.includes("package.json") || f.includes("lock")) &&
        lowerFiles.length <= 2) {
        return "chore";
    }
    if (lowerDiff.includes("fix") ||
        lowerDiff.includes("bug") ||
        lowerDiff.includes("error")) {
        return "fix";
    }
    return "feat";
}
function inferTopic(files, diff) {
    const stopWords = new Set([
        "src",
        "dist",
        "index",
        "readme",
        "package",
        "lock",
        "json",
        "ts",
        "js",
        "md",
        "diff",
        "added",
        "removed",
        "file",
        "files",
        "change",
        "changes",
        "update",
        "updated",
        "line",
        "lines",
    ]);
    // ファイル名ベースを優先し、diff本文は補助的に使う
    const fileTokens = files
        .flatMap((f) => f.split(/[\/._-]+/))
        .map((v) => v.toLowerCase())
        .filter((v) => isGoodTopicToken(v, stopWords));
    const diffTokens = diff
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((v) => isGoodTopicToken(v, stopWords))
        .slice(0, 20);
    const tokens = [...fileTokens, ...diffTokens]
        .map((v) => sanitizeBranchPart(v))
        .filter(Boolean);
    if (tokens.length === 0) {
        return "";
    }
    const unique = Array.from(new Set(tokens));
    return unique.slice(0, 3).join("-");
}
function isGoodTopicToken(token, stopWords) {
    if (token.length < 3) {
        return false;
    }
    if (stopWords.has(token)) {
        return false;
    }
    // 16進ハッシュ断片（例: 22e133f, cd9353f）を除外
    if (/^[a-f0-9]{6,}$/.test(token)) {
        return false;
    }
    // 数字主体トークンを除外
    if (/^\d+$/.test(token)) {
        return false;
    }
    return true;
}
function sanitizeBranchPart(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}
function randomSuffix() {
    return Math.random().toString(36).slice(2, 8);
}
function ensureAvailableBranchName(baseName) {
    const [headRaw, ...tailRaw] = baseName.split("/");
    const head = sanitizeBranchPart(headRaw || "feat");
    const tail = sanitizeBranchPart(tailRaw.join("-") || `update-${randomSuffix()}`);
    const normalized = `${head || "feat"}/${tail}`;
    if (!branchExists(normalized)) {
        return normalized;
    }
    let i = 2;
    while (branchExists(`${normalized}-${i}`)) {
        i += 1;
    }
    return `${normalized}-${i}`;
}
function branchExists(name) {
    try {
        (0, child_process_1.execSync)(`git show-ref --verify --quiet refs/heads/${name}`, {
            stdio: "pipe",
        });
        return true;
    }
    catch {
        return false;
    }
}
// ── コミットフロー共通処理 ────────────────────────────────
/**
 * コミットの基本フロー
 * 1. 変更をステージ（--no-add が指定されていない場合）
 * 2. AI でコミットメッセージを生成
 * 3. ユーザーに確認を求める
 * 4. 承認されたらコミットを実行
 */
async function runCommitFlow() {
    if (!noAdd) {
        console.log("📦 変更をステージしています... (git add .)");
        stageAllChanges();
    }
    const diff = getStagedDiff();
    if (!diff.trim()) {
        showFriendlyError("ステージされた変更が見つかりません", "コミットする変更がステージングエリアにありません", [
            "変更したファイルを確認: git status",
            "すべての変更をステージ: git add .",
            "特定のファイルだけステージ: git add <ファイル名>",
        ], [
            "ai-git commit --no-add (手動で git add した後)",
            "ai-git push (自動で git add してコミット＆プッシュ)",
        ]);
        process.exit(1);
    }
    console.log("🤖 コミットメッセージを生成中... (compact summary input)");
    const message = await generateCommitMessage(diff);
    console.log(`\n📝 Generated commit message:\n`);
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
// ── push サブコマンド ─────────────────────────────────────
/**
 * push サブコマンドのメイン処理
 * コミットフローを実行後、リモートにプッシュ
 */
async function mainPush() {
    await runCommitFlow();
    const currentBranch = (0, child_process_1.execSync)("git branch --show-current", {
        encoding: "utf-8",
    }).trim();
    pushCurrentBranch(currentBranch);
    console.log(`\n✅ Push 完了!`);
}
// ── メイン ───────────────────────────────────────────────
async function main() {
    if (subcommand === "checkout") {
        await mainCheckout();
        return;
    }
    if (subcommand === "pr") {
        await mainPR();
        return;
    }
    if (subcommand === "push") {
        await mainPush();
        return;
    }
    await runCommitFlow();
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
        showFriendlyError("GROQ_API_KEY が未設定です", "AI 機能を使用するには Groq API キーが必要です", [
            "Groq にサインアップ（無料）: https://console.groq.com/",
            "API キーを取得: https://console.groq.com/keys",
            "環境変数に設定:",
            '  - 一時的: export GROQ_API_KEY="gsk_..."',
            '  - 永続的: ~/.bashrc や ~/.zshrc に上記を追加',
        ], [
            "API キー設定後に ai-git commit を実行",
            "API キー設定後に ai-git pr を実行",
        ]);
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
            showFriendlyError("GitHub CLI (gh) がインストールされていません", "PR を作成するには GitHub CLI が必要です", [
                "GitHub CLI をインストール: https://cli.github.com/",
                "macOS: brew install gh",
                "Windows: winget install GitHub.cli",
                "Linux: 上記サイトから手順を確認",
            ], [
                "インストール後に ai-git pr を実行",
                "または、手動で GitHub のウェブサイトから PR を作成",
            ]);
        }
        else {
            showFriendlyError("GitHub CLI (gh) is not installed", "GitHub CLI is required to create pull requests", [
                "Install GitHub CLI: https://cli.github.com/",
                "macOS: brew install gh",
                "Windows: winget install GitHub.cli",
                "Linux: see the website above for instructions",
            ], [
                "Run ai-git pr after installation",
                "Or create PR manually on GitHub website",
            ]);
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
            showFriendlyError("GitHub CLI の認証が必要です", "GitHub にログインしていないため、PR を作成できません", [
                "対話式でログイン: gh auth login",
                "ブラウザが開くので、指示に従ってログインしてください",
                "または、Personal Access Token を使用: export GH_TOKEN=<your_token>",
                "Token 作成: https://github.com/settings/tokens",
            ], [
                "ログイン後に ai-git pr を実行",
                "ai-git commit でまずローカルにコミット（PR は後で作成）",
            ]);
        }
        else {
            showFriendlyError("GitHub CLI authentication is required", "You need to log in to GitHub to create pull requests", [
                "Interactive login: gh auth login",
                "Follow the browser instructions to log in",
                "Or use Personal Access Token: export GH_TOKEN=<your_token>",
                "Create token: https://github.com/settings/tokens",
            ], [
                "Run ai-git pr after logging in",
                "Use ai-git commit to commit locally first (create PR later)",
            ]);
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
        showFriendlyError("ベースブランチを検出できませんでした", "main, master, develop のいずれも存在しません", [
            "リポジトリのデフォルトブランチを確認: git branch -a",
            "ベースブランチを作成: git checkout -b main",
            "リモートからブランチを取得: git fetch origin",
            "リモートのデフォルトブランチを設定: git remote set-head origin --auto",
        ], [
            "ベースブランチ作成後に ai-git pr を実行",
            "ai-git commit で現在のブランチにコミット",
        ]);
    }
    else {
        showFriendlyError("Could not detect base branch", "None of main, master, develop exist", [
            "Check repository branches: git branch -a",
            "Create base branch: git checkout -b main",
            "Fetch branches from remote: git fetch origin",
            "Set remote default branch: git remote set-head origin --auto",
        ], [
            "Run ai-git pr after creating base branch",
            "Use ai-git commit to commit to current branch",
        ]);
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
            showFriendlyError("ブランチの差分取得に失敗しました", `${baseBranch} ブランチとの差分を取得できませんでした`, [
                "ブランチの状態を確認: git log --oneline",
                `ベースブランチ (${baseBranch}) が存在するか確認: git branch -a`,
                "リモートから最新を取得: git fetch origin",
                "コミットがあるか確認: git log",
            ], [
                "コミットがない場合は ai-git commit でまずコミット",
                "ブランチが存在しない場合は ai-git checkout で作成",
            ]);
        }
        else {
            showFriendlyError("Failed to get branch diff", `Could not get diff with ${baseBranch} branch`, [
                "Check branch status: git log --oneline",
                `Check if base branch (${baseBranch}) exists: git branch -a`,
                "Fetch latest from remote: git fetch origin",
                "Check if there are commits: git log",
            ], [
                "Use ai-git commit to create commits first",
                "Use ai-git checkout to create a new branch",
            ]);
        }
        process.exit(1);
    }
}
function buildPRPrompt(commits, diff, lang) {
    if (lang === "ja") {
        return `あなたは GitHub の Pull Request 作成の専門家です。
次のコミット履歴と差分から、PR のタイトルと説明文を生成してください。

出力フォーマット（必ずこの順番で出力してください）:
1行目: Title: <Conventional Commits 形式のタイトル（72文字以内、日本語で）>
2行目: 空行
3行目以降: PR 説明文（以下の形式）

説明文のルール:
- ## Summary: 1-2文で変更の概要を説明
- ## Changes: "- " で始まる箇条書き（3-7個）で具体的な変更内容
- ## Test plan: テスト方法の箇条書き（2-4個）
- 命令形を使う
- WHATとWHYを重視し、HOWは最小限に
- 出力はタイトルとPR説明文のみ（余計な説明は不要）

タイトルの例:
Title: feat: push サブコマンドを追加する
Title: fix: コミットメッセージ生成のエラーハンドリングを修正する

コミット履歴:
${commits}

変更差分:
${diff}`;
    }
    return `You are an expert at writing GitHub Pull Request descriptions.
Generate a PR title and description from the following commit history and diff.

Output format (in this exact order):
Line 1: Title: <Conventional Commits title, max 72 chars>
Line 2: empty line
Line 3+: PR description in the following format

Description rules:
- ## Summary: 1-2 sentences explaining the overall change
- ## Changes: bullet points (3-7 items) with "- " prefix detailing specific changes
- ## Test plan: bullet points (2-4 items) describing how to test
- Use imperative mood
- Focus on WHAT and WHY, minimize HOW
- Output ONLY the title line and PR description, no extra explanation

Title examples:
Title: feat: add push subcommand
Title: fix: improve error handling in commit message generation

Commit history:
${commits}

Diff:
${diff}`;
}
/**
 * ベースブランチとの差分から PR の説明文を AI で生成
 * コミット履歴と diff を分析して、適切なタイトルと本文を作成
 */
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
/**
 * AI が出力した "Title: <text>" 行からタイトルを抽出する。
 * 見つからない場合は description の先頭テキストからフォールバック。
 */
function extractPRTitle(raw) {
    const firstLine = raw.split("\n")[0]?.trim() ?? "";
    const titleMatch = /^Title:\s*(.+)$/i.exec(firstLine);
    if (titleMatch?.[1]) {
        return titleMatch[1].trim();
    }
    // フォールバック: Summary 直下の最初の文
    const lines = raw
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
    const summaryIdx = lines.findIndex((l) => l.toLowerCase().startsWith("## summary"));
    let candidate = summaryIdx >= 0
        ? (lines.slice(summaryIdx + 1).find((l) => !l.startsWith("##")) ?? "")
        : (lines.find((l) => !l.startsWith("#") && !l.startsWith("-")) ?? "");
    candidate = candidate
        .replace(/^this pull request\s+(is|does)\s*/i, "")
        .replace(/^この\s*pull request\s*は、?/i, "")
        .replace(/^このprは、?/i, "")
        .replace(/\s+/g, " ")
        .trim();
    const sentenceCut = candidate.search(/[。.!?]/);
    if (sentenceCut > 0) {
        candidate = candidate.slice(0, sentenceCut);
    }
    return candidate || "Update project changes";
}
/**
 * "Title: <text>" 行を description 本文から除いて返す。
 */
function stripTitleLine(raw) {
    const lines = raw.split("\n");
    if (/^Title:\s*/i.test(lines[0]?.trim() ?? "")) {
        // Title 行と直後の空行を除去
        return lines.slice(lines[1]?.trim() === "" ? 2 : 1).join("\n").trimStart();
    }
    return raw;
}
function createPR(description, baseBranch, fallbackURL) {
    const titleLine = extractPRTitle(description);
    const body = stripTitleLine(description);
    const result = (0, child_process_1.spawnSync)("gh", [
        "pr",
        "create",
        "--base",
        baseBranch,
        "--title",
        titleLine.trim(),
        "--body",
        body,
    ], { encoding: "utf-8", stdio: "pipe" });
    if (result.stdout) {
        process.stdout.write(result.stdout);
    }
    if (result.stderr) {
        process.stderr.write(result.stderr);
    }
    if (result.status !== 0) {
        if (language === "ja") {
            const solutions = [
                "ブランチがプッシュされているか確認: git log origin/$(git branch --show-current)",
                "GitHub への接続を確認してください",
                "gh auth status で認証状態を確認",
                "同名の PR が既に存在しないか GitHub で確認",
            ];
            if (fallbackURL) {
                solutions.push(`手動で作成: ${fallbackURL}`);
            }
            showFriendlyError("PR の作成に失敗しました", "GitHub CLI で PR を作成できませんでした", solutions, [
                "エラーを確認・修正後に ai-git pr を再実行",
                "ai-git push でブランチをプッシュ（未プッシュの場合）",
            ]);
        }
        else {
            const solutions = [
                "Check if branch is pushed: git log origin/$(git branch --show-current)",
                "Verify GitHub connection",
                "Check auth status: gh auth status",
                "Check if PR with same name already exists on GitHub",
            ];
            if (fallbackURL) {
                solutions.push(`Create manually: ${fallbackURL}`);
            }
            showFriendlyError("Failed to create PR", "Could not create pull request via GitHub CLI", solutions, [
                "Fix the error and run ai-git pr again",
                "Use ai-git push to push branch (if not pushed)",
            ]);
        }
        process.exit(1);
    }
}
/**
 * pr サブコマンドのメイン処理
 * 1. GitHub CLI の確認と認証
 * 2. ベースブランチの検出
 * 3. ブランチを自動プッシュ（未プッシュの場合）
 * 4. AI で PR の説明文を生成
 * 5. ユーザーに確認後、GitHub CLI で PR を作成
 */
async function mainPR() {
    checkGHCLI();
    checkGHAuth();
    const baseBranch = detectBaseBranch();
    const currentBranch = (0, child_process_1.execSync)("git branch --show-current", {
        encoding: "utf-8",
    }).trim();
    if (currentBranch === baseBranch) {
        if (language === "ja") {
            showFriendlyError(`ベースブランチ (${baseBranch}) から PR を作成できません`, "PR は異なるブランチから作成する必要があります", [
                "新しいブランチを作成してください",
                "または、既存のブランチに切り替えてください: git checkout <ブランチ名>",
            ], [
                "ai-git checkout で新しいブランチを作成",
                "ブランチ作成後に変更をコミット: ai-git commit",
                "その後 PR を作成: ai-git pr",
            ]);
        }
        else {
            showFriendlyError(`Cannot create PR from base branch (${baseBranch})`, "PRs must be created from a different branch", [
                "Create a new branch",
                "Or switch to an existing branch: git checkout <branch-name>",
            ], [
                "Use ai-git checkout to create a new branch",
                "Commit changes after creating branch: ai-git commit",
                "Then create PR: ai-git pr",
            ]);
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
        const remoteCommit = (0, child_process_1.execSync)(`git rev-parse ${currentBranch}@{upstream}`, {
            encoding: "utf-8",
            stdio: "pipe",
        }).trim();
        if (localCommit !== remoteCommit) {
            // ローカルに新しいコミットがある場合は push
            console.log(`📤 ブランチを push 中... (origin ${currentBranch})`);
            const pushResult = (0, child_process_1.spawnSync)("git", ["push"], { stdio: "inherit" });
            if (pushResult.status !== 0) {
                if (language === "ja") {
                    showFriendlyError("ブランチの push に失敗しました (PR作成前)", "PR を作成する前にブランチをリモートにプッシュできませんでした", [
                        "リモートリポジトリの設定を確認: git remote -v",
                        "プッシュ権限を確認してください",
                        "リモートブランチとの競合確認: git pull --rebase",
                        "ネットワーク接続を確認してください",
                    ], [
                        "競合解決後に ai-git pr を再実行",
                        "手動でプッシュ: git push",
                    ]);
                }
                else {
                    showFriendlyError("Failed to push branch (before PR creation)", "Could not push branch to remote before creating PR", [
                        "Check remote repository: git remote -v",
                        "Verify push permissions",
                        "Check for conflicts: git pull --rebase",
                        "Verify network connection",
                    ], [
                        "Run ai-git pr again after fixing",
                        "Push manually: git push",
                    ]);
                }
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
                showFriendlyError("新しいブランチの push に失敗しました (PR作成前)", "PR を作成する前に新しいブランチをリモートに作成できませんでした", [
                    "リモートリポジトリの URL を確認: git remote -v",
                    "リモートリポジトリへのプッシュ権限を確認",
                    "SSH キーまたは認証情報が正しく設定されているか確認",
                    "ネットワーク接続を確認してください",
                ], [
                    "認証・権限を確認後に ai-git pr を再実行",
                    "手動でプッシュ: git push -u origin " + currentBranch,
                ]);
            }
            else {
                showFriendlyError("Failed to push new branch (before PR creation)", "Could not create new branch on remote before creating PR", [
                    "Check remote repository URL: git remote -v",
                    "Verify push permissions to remote",
                    "Check SSH keys or credentials are set up correctly",
                    "Verify network connection",
                ], [
                    "Run ai-git pr again after fixing auth/permissions",
                    "Push manually: git push -u origin " + currentBranch,
                ]);
            }
            process.exit(1);
        }
    }
    console.log(`🤖 PR説明文を生成中... (${baseBranch}...${currentBranch}) [compact summary input]`);
    const description = await generatePRDescription(baseBranch);
    console.log(`\n📝 Generated PR:\n`);
    console.log(`  Title: ${extractPRTitle(description)}`);
    console.log();
    stripTitleLine(description)
        .split("\n")
        .forEach((line) => {
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
