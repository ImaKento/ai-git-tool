import { execSync, spawnSync } from "child_process";
import { checkIfGitRepository, showFriendlyError } from "./errors.js";

/**
 * ステージされた差分を取得
 */
export function getStagedDiff(): string {
  checkIfGitRepository();
  try {
    return execSync("git diff --cached", { encoding: "utf-8" });
  } catch {
    showFriendlyError(
      "Git の差分取得に失敗しました",
      "git diff コマンドの実行に失敗しました",
      [
        "Git がインストールされているか確認してください: git --version",
        "カレントディレクトリが Git リポジトリか確認してください: git status",
      ],
      ["ai-git commit で変更をコミット", "ai-git checkout で新しいブランチを作成"],
    );
    process.exit(1);
  }
}

/**
 * コマンドの出力を取得（エラーは無視）
 */
export function getCommandOutput(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", stdio: "pipe" });
  } catch {
    return "";
  }
}

/**
 * 変更されたファイル一覧を取得
 */
export function getChangedFiles(): string[] {
  const staged = getCommandOutput("git diff --cached --name-only");
  const unstaged = getCommandOutput("git diff --name-only");
  const merged = `${staged}\n${unstaged}`
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  return Array.from(new Set(merged));
}

/**
 * 全差分を取得（ステージ済み + 未ステージ）
 */
export function getCombinedDiff(): string {
  const staged = getCommandOutput("git diff --cached");
  const unstaged = getCommandOutput("git diff");
  return `${staged}\n${unstaged}`;
}

/**
 * すべての変更をステージ
 */
export function stageAllChanges(): void {
  const result = spawnSync("git", ["add", "."], { stdio: "inherit" });
  if (result.status !== 0) {
    showFriendlyError(
      "ファイルのステージングに失敗しました",
      "git add . コマンドが失敗しました",
      [
        "カレントディレクトリを確認: pwd",
        "Git の状態を確認: git status",
        ".gitignore で除外されているファイルがないか確認",
        "ファイルのパーミッションを確認してください",
      ],
      [
        "ai-git commit --no-add (手動で git add する場合)",
        "特定のファイルだけ追加: git add <ファイル名>",
      ],
    );
    process.exit(1);
  }
}

/**
 * コミットを実行
 */
export function doCommit(message: string): void {
  const result = spawnSync("git", ["commit", "-m", message], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    showFriendlyError(
      "コミットに失敗しました",
      "git commit コマンドが失敗しました（pre-commit フックのエラーや空のコミットの可能性があります）",
      [
        "ステージされたファイルを確認: git status",
        "pre-commit フックがある場合は、エラー内容を確認してください",
        "空のコミットを許可する場合: git commit --allow-empty -m 'メッセージ'",
      ],
      ["エラーを修正後に ai-git commit を再実行"],
    );
    process.exit(1);
  }
}

/**
 * 現在のブランチをリモートにプッシュ
 */
export function pushCurrentBranch(currentBranch: string): void {
  try {
    execSync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    console.log(`📤 push 中... (origin ${currentBranch})`);
    const pushResult = spawnSync("git", ["push"], { stdio: "inherit" });
    if (pushResult.status !== 0) {
      showFriendlyError(
        "プッシュに失敗しました",
        "リモートへのプッシュが失敗しました（権限不足やネットワークエラーの可能性があります）",
        [
          "リモートリポジトリの設定を確認: git remote -v",
          "プッシュ権限があるか確認してください",
          "ネットワーク接続を確認してください",
          "リモートブランチとの競合がないか確認: git pull",
        ],
        [
          "競合を解決後に ai-git push を再実行",
          "ai-git pr で Pull Request を作成（プッシュ済みの場合）",
        ],
      );
      process.exit(1);
    }
  } catch {
    console.log(`📤 push 中... (origin ${currentBranch} を新規作成)`);
    const pushResult = spawnSync("git", ["push", "-u", "origin", currentBranch], {
      stdio: "inherit",
    });
    if (pushResult.status !== 0) {
      showFriendlyError(
        "新しいブランチのプッシュに失敗しました",
        "リモートに新しいブランチを作成できませんでした（権限不足やネットワークエラーの可能性があります）",
        [
          "リモートリポジトリの URL を確認: git remote -v",
          "リモートリポジトリへのプッシュ権限があるか確認",
          "ネットワーク接続を確認してください",
          "SSH キーまたは認証情報が正しく設定されているか確認",
        ],
        [
          "権限を確認後に ai-git push を再実行",
          "手動でプッシュ: git push -u origin " + currentBranch,
        ],
      );
      process.exit(1);
    }
  }
}

/**
 * ブランチが存在するかチェック
 */
export function branchExists(name: string): boolean {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${name}`, {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 現在のブランチ名を取得
 */
export function getCurrentBranch(): string {
  return execSync("git branch --show-current", { encoding: "utf-8" }).trim();
}
