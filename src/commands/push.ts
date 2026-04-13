import { execSync } from "child_process";
import type { Language } from "../types.js";
import { runCommitCommand } from "./commit.js";
import { pushCurrentBranch, getCurrentBranch, getStagedDiff, stageAllChanges } from "../utils/git.js";

/**
 * 未プッシュのコミットがあるかチェック
 */
function hasUnpushedCommits(currentBranch: string): boolean {
  try {
    // upstream が設定されているかチェック
    execSync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });

    // upstream と比較
    const localCommit = execSync(`git rev-parse ${currentBranch}`, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    const remoteCommit = execSync(`git rev-parse ${currentBranch}@{upstream}`, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    return localCommit !== remoteCommit;
  } catch {
    // upstream が設定されていない場合、コミットがあればプッシュすべき
    try {
      const commitCount = execSync("git rev-list --count HEAD", {
        encoding: "utf-8",
        stdio: "pipe",
      }).trim();
      return parseInt(commitCount, 10) > 0;
    } catch {
      return false;
    }
  }
}

/**
 * push コマンドの実行
 */
export async function runPushCommand(
  language: Language,
  noAdd: boolean,
): Promise<void> {
  const currentBranch = getCurrentBranch();

  // ステージされた変更をチェック（--no-add の場合は git add をスキップ）
  if (!noAdd) {
    console.log("📦 変更をステージしています... (git add .)");
    stageAllChanges();
  }

  const diff = getStagedDiff();
  const hasStagedChanges = diff.trim().length > 0;

  if (hasStagedChanges) {
    // ステージされた変更がある場合は、通常のコミットフローを実行
    await runCommitCommand(language, true); // noAdd=true（すでにステージ済み）
  } else {
    // ステージされた変更がない場合、未プッシュのコミットがあるかチェック
    if (hasUnpushedCommits(currentBranch)) {
      console.log("💡 ステージされた変更はありませんが、未プッシュのコミットがあります");
      console.log("📤 コミットをプッシュします...");
    } else {
      console.error("❌ プッシュするものがありません");
      console.error("");
      console.error("📋 原因: ステージされた変更も未プッシュのコミットもありません");
      console.error("");
      console.error("💡 解決方法:");
      console.error("   1. 変更を確認: git status");
      console.error("   2. 変更をステージ: git add .");
      console.error("   3. または、まずコミット: ai-git commit");
      process.exit(1);
    }
  }

  pushCurrentBranch(currentBranch);
  console.log(`\n✅ Push 完了!`);
}
