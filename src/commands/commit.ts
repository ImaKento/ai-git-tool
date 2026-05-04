import type { Language } from "../types.js";
import { getStagedDiff, stageAllChanges, doCommit } from "../utils/git.js";
import { askUser, editInEditor } from "../utils/ui.js";
import { showFriendlyError } from "../utils/errors.js";
import { generateCommitMessage } from "../services/ai.js";

/**
 * commit コマンドの実行
 */
export async function runCommitCommand(
  language: Language,
  noAdd: boolean,
): Promise<void> {
  if (!noAdd) {
    console.log("📦 変更をステージしています... (git add .)");
    stageAllChanges();
  }

  const diff = getStagedDiff();

  if (!diff.trim()) {
    showFriendlyError(
      "ステージされた変更が見つかりません",
      "コミットする変更がステージングエリアにありません",
      [
        "変更したファイルを確認: git status",
        "すべての変更をステージ: git add .",
        "特定のファイルだけステージ: git add <ファイル名>",
      ],
      [
        "ai-git commit --no-add (手動で git add した後)",
        "ai-git push (自動で git add してコミット＆プッシュ)",
      ],
    );
    process.exit(1);
  }

  console.log("🤖 コミットメッセージを生成中... (compact summary input)");

  const message = await generateCommitMessage(diff, language);

  console.log(`\n📝 Generated commit message:\n`);
  message.split("\n").forEach((line) => {
    console.log(`  ${line}`);
  });
  console.log();

  const answer = await askUser("Use this message? [y/n/e(edit)]: ");

  let finalMessage = message;

  if (answer === "e" || answer === "edit") {
    finalMessage = await editInEditor(message);
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
