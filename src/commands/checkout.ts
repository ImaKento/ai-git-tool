import { spawnSync } from "child_process";
import { showFriendlyError } from "../utils/errors.js";
import { suggestBranchName } from "../services/ai.js";
import { ensureAvailableBranchName } from "../services/branch.js";

/**
 * checkout コマンドの実行
 */
export async function runCheckoutCommand(targetBranch?: string): Promise<void> {
  if (targetBranch) {
    const checkoutResult = spawnSync("git", ["checkout", targetBranch], {
      stdio: "inherit",
    });
    if (checkoutResult.status !== 0) {
      showFriendlyError(
        `ブランチへの移動に失敗しました: ${targetBranch}`,
        "git checkout コマンドが失敗しました",
        [
          `ブランチが存在するか確認: git branch -a | grep ${targetBranch}`,
          "現在の変更を確認: git status",
          "未コミット変更がある場合は commit または stash を実施",
        ],
        [`手動で移動: git checkout ${targetBranch}`],
      );
      process.exit(1);
    }

    console.log(`✅ ブランチに移動しました: ${targetBranch}`);
    console.log(`🔄 最新を取得中... (${targetBranch})`);

    const pullResult = spawnSync("git", ["pull"], { stdio: "inherit" });
    if (pullResult.status !== 0) {
      showFriendlyError(
        `pull に失敗しました: ${targetBranch}`,
        "git pull コマンドが失敗しました（競合や upstream 未設定の可能性があります）",
        [
          "upstream を確認: git branch -vv",
          "必要なら upstream を設定: git branch --set-upstream-to=origin/<branch>",
          "競合がある場合は解消してから再実行",
        ],
        [`手動で実行: git pull origin ${targetBranch}`],
      );
      process.exit(1);
    }

    console.log(`✅ 最新状態に更新しました: ${targetBranch}`);
    return;
  }

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
