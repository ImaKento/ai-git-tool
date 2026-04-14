import { execSync, spawnSync } from "child_process";
import type { Language } from "../types.js";
import { showFriendlyError } from "../utils/errors.js";
import { askUser } from "../utils/ui.js";

/**
 * GitHub CLI がインストールされているかチェック
 */
export function checkGHCLI(language: Language): void {
  try {
    execSync("gh --version", { encoding: "utf-8", stdio: "pipe" });
  } catch {
    if (language === "ja") {
      showFriendlyError(
        "GitHub CLI (gh) がインストールされていません",
        "PR を作成するには GitHub CLI が必要です",
        [
          "GitHub CLI をインストール: https://cli.github.com/",
          "macOS: brew install gh",
          "Windows: winget install GitHub.cli",
          "Linux: 上記サイトから手順を確認",
        ],
        [
          "インストール後に ai-git pr を実行",
          "または、手動で GitHub のウェブサイトから PR を作成",
        ],
      );
    } else {
      showFriendlyError(
        "GitHub CLI (gh) is not installed",
        "GitHub CLI is required to create pull requests",
        [
          "Install GitHub CLI: https://cli.github.com/",
          "macOS: brew install gh",
          "Windows: winget install GitHub.cli",
          "Linux: see the website above for instructions",
        ],
        [
          "Run ai-git pr after installation",
          "Or create PR manually on GitHub website",
        ],
      );
    }
    process.exit(1);
  }
}

/**
 * GitHub CLI の認証状態をチェック
 */
export function checkGHAuth(language: Language): void {
  if (process.env.GH_TOKEN) {
    return;
  }

  try {
    execSync("gh auth status", { encoding: "utf-8", stdio: "pipe" });
  } catch {
    if (language === "ja") {
      showFriendlyError(
        "GitHub CLI の認証が必要です",
        "GitHub にログインしていないため、PR を作成できません",
        [
          "対話式でログイン: gh auth login",
          "ブラウザが開くので、指示に従ってログインしてください",
          "または、Personal Access Token を使用: export GH_TOKEN=<your_token>",
          "Token 作成: https://github.com/settings/tokens",
        ],
        [
          "ログイン後に ai-git pr を実行",
          "ai-git commit でまずローカルにコミット（PR は後で作成）",
        ],
      );
    } else {
      showFriendlyError(
        "GitHub CLI authentication is required",
        "You need to log in to GitHub to create pull requests",
        [
          "Interactive login: gh auth login",
          "Follow the browser instructions to log in",
          "Or use Personal Access Token: export GH_TOKEN=<your_token>",
          "Create token: https://github.com/settings/tokens",
        ],
        [
          "Run ai-git pr after logging in",
          "Use ai-git commit to commit locally first (create PR later)",
        ],
      );
    }
    process.exit(1);
  }
}

/**
 * ベースブランチを検出
 */
export function detectBaseBranch(language: Language): string {
  try {
    const result = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    return result.replace("refs/remotes/origin/", "");
  } catch {
    // Fallback
  }

  for (const branch of ["main", "master", "develop"]) {
    try {
      execSync(`git rev-parse --verify ${branch}`, { stdio: "pipe" });
      return branch;
    } catch {
      continue;
    }
  }

  if (language === "ja") {
    showFriendlyError(
      "ベースブランチを検出できませんでした",
      "main, master, develop のいずれも存在しません",
      [
        "リポジトリのデフォルトブランチを確認: git branch -a",
        "ベースブランチを作成: git checkout -b main",
        "リモートからブランチを取得: git fetch origin",
        "リモートのデフォルトブランチを設定: git remote set-head origin --auto",
      ],
      [
        "ベースブランチ作成後に ai-git pr を実行",
        "ai-git commit で現在のブランチにコミット",
      ],
    );
  } else {
    showFriendlyError(
      "Could not detect base branch",
      "None of main, master, develop exist",
      [
        "Check repository branches: git branch -a",
        "Create base branch: git checkout -b main",
        "Fetch branches from remote: git fetch origin",
        "Set remote default branch: git remote set-head origin --auto",
      ],
      [
        "Run ai-git pr after creating base branch",
        "Use ai-git commit to commit to current branch",
      ],
    );
  }
  process.exit(1);
}

/**
 * ブランチの差分を取得
 */
export function getBranchDiff(
  baseBranch: string,
  language: Language,
): { commits: string; diff: string } {
  try {
    const commits = execSync(
      `git log ${baseBranch}..HEAD --format="%h %s%n%b%n---"`,
      { encoding: "utf-8" },
    );

    const diff = execSync(`git diff ${baseBranch}...HEAD`, {
      encoding: "utf-8",
    });

    return { commits, diff };
  } catch {
    if (language === "ja") {
      showFriendlyError(
        "ブランチの差分取得に失敗しました",
        `${baseBranch} ブランチとの差分を取得できませんでした`,
        [
          "ブランチの状態を確認: git log --oneline",
          `ベースブランチ (${baseBranch}) が存在するか確認: git branch -a`,
          "リモートから最新を取得: git fetch origin",
          "コミットがあるか確認: git log",
        ],
        [
          "コミットがない場合は ai-git commit でまずコミット",
          "ブランチが存在しない場合は ai-git checkout で作成",
        ],
      );
    } else {
      showFriendlyError(
        "Failed to get branch diff",
        `Could not get diff with ${baseBranch} branch`,
        [
          "Check branch status: git log --oneline",
          `Check if base branch (${baseBranch}) exists: git branch -a`,
          "Fetch latest from remote: git fetch origin",
          "Check if there are commits: git log",
        ],
        [
          "Use ai-git commit to create commits first",
          "Use ai-git checkout to create a new branch",
        ],
      );
    }
    process.exit(1);
  }
}

/**
 * GitHub リポジトリのパスをパース
 */
export function parseGitHubRepoPath(remoteUrl: string): string | null {
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

/**
 * Pull Request の URL を取得
 */
export function getPullRequestURL(branch: string): string | null {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    const repoPath = parseGitHubRepoPath(remoteUrl);
    if (!repoPath) {
      return null;
    }
    return `https://github.com/${repoPath}/pull/new/${branch}`;
  } catch {
    return null;
  }
}

/**
 * PR を作成
 */
export function createPR(
  description: string,
  baseBranch: string,
  fallbackURL: string | null,
  language: Language,
  extractPRTitle: (raw: string) => string,
  stripTitleLine: (raw: string) => string,
): void {
  const titleLine = extractPRTitle(description);
  const body = stripTitleLine(description);

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
      body,
    ],
    { encoding: "utf-8", stdio: "pipe" },
  );

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
      showFriendlyError(
        "PR の作成に失敗しました",
        "GitHub CLI で PR を作成できませんでした",
        solutions,
        [
          "エラーを確認・修正後に ai-git pr を再実行",
          "ai-git push でブランチをプッシュ（未プッシュの場合）",
        ],
      );
    } else {
      const solutions = [
        "Check if branch is pushed: git log origin/$(git branch --show-current)",
        "Verify GitHub connection",
        "Check auth status: gh auth status",
        "Check if PR with same name already exists on GitHub",
      ];
      if (fallbackURL) {
        solutions.push(`Create manually: ${fallbackURL}`);
      }
      showFriendlyError(
        "Failed to create PR",
        "Could not create pull request via GitHub CLI",
        solutions,
        [
          "Fix the error and run ai-git pr again",
          "Use ai-git push to push branch (if not pushed)",
        ],
      );
    }
    process.exit(1);
  }
}

/**
 * ブランチを push（PR 作成前）
 */
export function pushBranchForPR(currentBranch: string, language: Language): void {
  try {
    execSync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    const localCommit = execSync(`git rev-parse ${currentBranch}`, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    const remoteCommit = execSync(`git rev-parse ${currentBranch}@{upstream}`, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    if (localCommit !== remoteCommit) {
      console.log(`📤 ブランチを push 中... (origin ${currentBranch})`);
      const pushResult = spawnSync("git", ["push"], { stdio: "inherit" });
      if (pushResult.status !== 0) {
        if (language === "ja") {
          showFriendlyError(
            "ブランチの push に失敗しました (PR作成前)",
            "PR を作成する前にブランチをリモートにプッシュできませんでした",
            [
              "リモートリポジトリの設定を確認: git remote -v",
              "プッシュ権限を確認してください",
              "リモートブランチとの競合確認: git pull --rebase",
              "ネットワーク接続を確認してください",
            ],
            [
              "競合解決後に ai-git pr を再実行",
              "手動でプッシュ: git push",
            ],
          );
        } else {
          showFriendlyError(
            "Failed to push branch (before PR creation)",
            "Could not push branch to remote before creating PR",
            [
              "Check remote repository: git remote -v",
              "Verify push permissions",
              "Check for conflicts: git pull --rebase",
              "Verify network connection",
            ],
            [
              "Run ai-git pr again after fixing",
              "Push manually: git push",
            ],
          );
        }
        process.exit(1);
      }
    }
  } catch {
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
        showFriendlyError(
          "新しいブランチの push に失敗しました (PR作成前)",
          "PR を作成する前に新しいブランチをリモートに作成できませんでした",
          [
            "リモートリポジトリの URL を確認: git remote -v",
            "リモートリポジトリへのプッシュ権限を確認",
            "SSH キーまたは認証情報が正しく設定されているか確認",
            "ネットワーク接続を確認してください",
          ],
          [
            "認証・権限を確認後に ai-git pr を再実行",
            "手動でプッシュ: git push -u origin " + currentBranch,
          ],
        );
      } else {
        showFriendlyError(
          "Failed to push new branch (before PR creation)",
          "Could not create new branch on remote before creating PR",
          [
            "Check remote repository URL: git remote -v",
            "Verify push permissions to remote",
            "Check SSH keys or credentials are set up correctly",
            "Verify network connection",
          ],
          [
            "Run ai-git pr again after fixing auth/permissions",
            "Push manually: git push -u origin " + currentBranch,
          ],
        );
      }
      process.exit(1);
    }
  }
}

/**
 * コンフリクトがあるかを非破壊的に検知
 */
export function checkConflicts(baseBranch: string): boolean {
  try {
    const mergeBase = execSync(`git merge-base HEAD origin/${baseBranch}`, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    const mergeTreeOutput = execSync(
      `git merge-tree ${mergeBase} origin/${baseBranch} HEAD`,
      {
        encoding: "utf-8",
        stdio: "pipe",
      },
    );

    return mergeTreeOutput.includes("<<<<<<<");
  } catch {
    return false;
  }
}

/**
 * ベースブランチとの同期処理（PR作成前）
 */
export async function syncWithBaseBranch(
  baseBranch: string,
  currentBranch: string,
  language: Language,
): Promise<void> {
  console.log(
    language === "ja"
      ? `🔄 ${baseBranch} との同期を確認中...`
      : `🔄 Checking sync with ${baseBranch}...`,
  );

  // 最新を取得
  try {
    execSync(`git fetch origin ${baseBranch}`, { stdio: "pipe" });
  } catch {
    if (language === "ja") {
      showFriendlyError(
        "リモートブランチの取得に失敗しました",
        `origin/${baseBranch} を取得できませんでした`,
        [
          "ネットワーク接続を確認してください",
          "リモートリポジトリの設定を確認: git remote -v",
          `リモートに ${baseBranch} ブランチが存在するか確認`,
        ],
        ["接続を確認後に ai-git pr を再実行"],
      );
    } else {
      showFriendlyError(
        "Failed to fetch remote branch",
        `Could not fetch origin/${baseBranch}`,
        [
          "Check network connection",
          "Check remote repository: git remote -v",
          `Check if ${baseBranch} branch exists on remote`,
        ],
        ["Run ai-git pr again after fixing connection"],
      );
    }
    process.exit(1);
  }

  // コンフリクトチェック
  const hasConflicts = checkConflicts(baseBranch);

  if (!hasConflicts) {
    // コンフリクトなし → 自動的にマージ
    console.log(
      language === "ja"
        ? `✅ コンフリクトなし - origin/${baseBranch} をマージ中...`
        : `✅ No conflicts - merging origin/${baseBranch}...`,
    );

    const mergeResult = spawnSync("git", ["merge", `origin/${baseBranch}`], {
      stdio: "inherit",
    });

    if (mergeResult.status !== 0) {
      if (language === "ja") {
        showFriendlyError(
          "マージに失敗しました",
          `origin/${baseBranch} のマージ中にエラーが発生しました`,
          [
            "Git の状態を確認: git status",
            "マージを中止する場合: git merge --abort",
          ],
          ["問題を解決後に ai-git pr を再実行"],
        );
      } else {
        showFriendlyError(
          "Merge failed",
          `Error occurred while merging origin/${baseBranch}`,
          ["Check git status: git status", "Abort merge: git merge --abort"],
          ["Run ai-git pr again after fixing"],
        );
      }
      process.exit(1);
    }

    console.log(
      language === "ja"
        ? `✅ origin/${baseBranch} をマージしました`
        : `✅ Merged origin/${baseBranch}`,
    );
    return;
  }

  // コンフリクトあり → 選択肢を提示
  console.log(
    language === "ja"
      ? `⚠️  origin/${baseBranch} とのコンフリクトを検知しました`
      : `⚠️  Conflicts detected with origin/${baseBranch}`,
  );

  const choices =
    language === "ja"
      ? `次の操作を選択してください:
  [m] merge origin/${baseBranch} してコンフリクトを解消してからPR作成
  [r] rebase onto origin/${baseBranch} してコンフリクトを解消してからPR作成
  [s] スキップ（そのままPR作成）
  [a] 中止
選択 [m/r/s/a]: `
      : `Choose an action:
  [m] merge origin/${baseBranch} and resolve conflicts before creating PR
  [r] rebase onto origin/${baseBranch} and resolve conflicts before creating PR
  [s] skip (create PR anyway)
  [a] abort
Choice [m/r/s/a]: `;

  const choice = await askUser(choices);

  if (choice === "m" || choice === "merge") {
    console.log(
      language === "ja"
        ? `🔀 origin/${baseBranch} をマージ中...`
        : `🔀 Merging origin/${baseBranch}...`,
    );
    const result = spawnSync("git", ["merge", `origin/${baseBranch}`], {
      stdio: "inherit",
    });

    if (result.status !== 0) {
      if (language === "ja") {
        console.log(
          `\n⚠️  コンフリクトを解消してください。解消後、以下を実行:`,
        );
        console.log(`   git add .`);
        console.log(`   git commit`);
        console.log(`   ai-git pr\n`);
      } else {
        console.log(`\n⚠️  Please resolve conflicts. After resolving, run:`);
        console.log(`   git add .`);
        console.log(`   git commit`);
        console.log(`   ai-git pr\n`);
      }
      process.exit(1);
    }
  } else if (choice === "r" || choice === "rebase") {
    console.log(
      language === "ja"
        ? `🔀 origin/${baseBranch} へ rebase 中...`
        : `🔀 Rebasing onto origin/${baseBranch}...`,
    );
    const result = spawnSync("git", ["rebase", `origin/${baseBranch}`], {
      stdio: "inherit",
    });

    if (result.status !== 0) {
      if (language === "ja") {
        console.log(
          `\n⚠️  コンフリクトを解消してください。解消後、以下を実行:`,
        );
        console.log(`   git add .`);
        console.log(`   git rebase --continue`);
        console.log(`   ai-git pr\n`);
      } else {
        console.log(`\n⚠️  Please resolve conflicts. After resolving, run:`);
        console.log(`   git add .`);
        console.log(`   git rebase --continue`);
        console.log(`   ai-git pr\n`);
      }
      process.exit(1);
    }
  } else if (choice === "a" || choice === "abort") {
    console.log(language === "ja" ? "中止しました。" : "Aborted.");
    process.exit(0);
  }
  // 's' または 'skip' の場合はそのまま続行
}
