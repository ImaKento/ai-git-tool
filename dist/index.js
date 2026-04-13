#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const text_js_1 = require("./utils/text.js");
const config_js_1 = require("./utils/config.js");
const commit_js_1 = require("./commands/commit.js");
const push_js_1 = require("./commands/push.js");
const pr_js_1 = require("./commands/pr.js");
const checkout_js_1 = require("./commands/checkout.js");
// ── フラグ解析 ──────────────────────────────────────────
const args = process.argv.slice(2);
// サブコマンドの抽出
const subcommand = args[0];
const subcommandArgs = args.slice(1);
const showHelp = args.includes("--help") || args.includes("-h") || subcommand === "help";
const setLangArg = (0, text_js_1.getOptionValue)(args, "--set-lang");
const langArg = (0, text_js_1.getOptionValue)(subcommandArgs, "--lang");
const noAdd = subcommandArgs.includes("--no-add");
if (setLangArg) {
    const nextLang = (0, config_js_1.parseLanguage)(setLangArg);
    if (!nextLang) {
        console.error("Error: --set-lang は ja または en を指定してください。");
        process.exit(1);
    }
    (0, config_js_1.saveConfig)({ language: nextLang });
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
const language = (0, config_js_1.resolveLanguage)(langArg);
// ── メイン ───────────────────────────────────────────────
async function main() {
    if (subcommand === "checkout") {
        await (0, checkout_js_1.runCheckoutCommand)();
        return;
    }
    if (subcommand === "pr") {
        await (0, pr_js_1.runPRCommand)(language);
        return;
    }
    if (subcommand === "push") {
        await (0, push_js_1.runPushCommand)(language, noAdd);
        return;
    }
    await (0, commit_js_1.runCommitCommand)(language, noAdd);
}
main().catch((err) => {
    console.error("❌ 予期しないエラー:", err.message);
    process.exit(1);
});
