import { spawnSync } from "child_process";
import { showFriendlyError } from "../utils/errors.js";
import { suggestBranchName } from "../services/ai.js";
import { ensureAvailableBranchName } from "../services/branch.js";

/**
 * checkout コマンドの実行
 */
export async function runCheckoutCommand(): Promise<void> {
  const suggested = await suggestBranchName();
  const branchName = ensureAvailableBranchName(suggested);
  const result = spawnSync("git", ["checkout", "-b", branchName], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    showFriendlyError(
      "ブランチ作成に失敗しました",
      "git checkout -b コマンドが失敗しました（未コミットの変更がある可能性があります）",
      [
        "現在の変更を確認: git status",
        "変更をコミットしてから新しいブランチを作成する",
        "変更を一時退避: git stash",
        "または、変更を含めたままブランチを作成: git checkout -b <ブランチ名>",
      ],
      [
        "ai-git commit でまず変更をコミット",
        "ai-git push でコミット＆プッシュしてから新しいブランチを作成",
      ],
    );
    process.exit(1);
  }
  console.log(`✅ ブランチを作成しました: ${branchName}`);
}
