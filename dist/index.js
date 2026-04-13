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
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const generative_ai_1 = require("@google/generative-ai");
// ── フラグ解析 ──────────────────────────────────────────
const args = process.argv.slice(2);
const short = args.includes("--short");
const showHelp = args.includes("--help") || args.includes("-h");
const langArg = getOptionValue(args, "--lang");
const setLangArg = getOptionValue(args, "--set-lang");
const CONFIG_DIR = path.join(os.homedir(), ".ai-commit");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
if (showHelp) {
    console.log(`
Usage: ai-commit [options]

Options:
  --short           Generate a short one-line commit message
  --lang <ja|en>    Set language for this run
  --set-lang <ja|en> Persist default language
  --help, -h        Show this help message

Environment:
  GEMINI_API_KEY   Your Google Gemini API key (required)
`);
    process.exit(0);
}
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
// ── Gemini APIでコミットメッセージ生成 ───────────────────
async function generateCommitMessage(diff) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY が未設定です。");
        console.error('   取得先: https://aistudio.google.com/apikey\n   例: export GEMINI_API_KEY="your_api_key"');
        process.exit(1);
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = buildPrompt(diff, short, language);
    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    }
    catch (error) {
        handleGeminiError(error);
        process.exit(1);
    }
}
function buildPrompt(diff, useShort, lang) {
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
function handleGeminiError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes("429") ||
        lower.includes("quota") ||
        lower.includes("rate")) {
        console.error("❌ Gemini API の利用上限に達しました（429: quota/rate limit）。");
        console.error("   - 少し待って再実行してください");
        console.error("   - Google AI Studio / GCP で請求設定と利用枠を確認してください");
        console.error("   - 必要なら別プロジェクトの API キーを利用してください");
        return;
    }
    if (lower.includes("401") ||
        lower.includes("403") ||
        lower.includes("api key")) {
        console.error("❌ Gemini API 認証エラーです。GEMINI_API_KEY を確認してください。");
        console.error("   取得先: https://aistudio.google.com/apikey");
        return;
    }
    console.error("❌ Gemini API 呼び出しに失敗しました。");
    console.error(`   詳細: ${message}`);
}
