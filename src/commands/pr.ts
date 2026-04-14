import type { Language } from "../types.js";
import { getCurrentBranch } from "../utils/git.js";
import { askUser, editInEditor } from "../utils/ui.js";
import { showFriendlyError } from "../utils/errors.js";
import {
  checkGHCLI,
  checkGHAuth,
  detectBaseBranch,
  getBranchDiff,
  getPullRequestURL,
  createPR,
  pushBranchForPR,
  syncWithBaseBranch,
} from "../services/github.js";
import {
  generatePRDescription,
  extractPRTitle,
  stripTitleLine,
} from "../services/ai.js";

/**
 * pr コマンドの実行
 */
export async function runPRCommand(language: Language): Promise<void> {
  checkGHCLI(language);
  checkGHAuth(language);

  const baseBranch = detectBaseBranch(language);
  const currentBranch = getCurrentBranch();

  if (currentBranch === baseBranch) {
    if (language === "ja") {
      showFriendlyError(
        `ベースブランチ (${baseBranch}) から PR を作成できません`,
        "PR は異なるブランチから作成する必要があります",
        [
          "新しいブランチを作成してください",
          "または、既存のブランチに切り替えてください: git checkout <ブランチ名>",
        ],
        [
          "ai-git checkout で新しいブランチを作成",
          "ブランチ作成後に変更をコミット: ai-git commit",
          "その後 PR を作成: ai-git pr",
        ],
      );
    } else {
      showFriendlyError(
        `Cannot create PR from base branch (${baseBranch})`,
        "PRs must be created from a different branch",
        [
          "Create a new branch",
          "Or switch to an existing branch: git checkout <branch-name>",
        ],
        [
          "Use ai-git checkout to create a new branch",
          "Commit changes after creating branch: ai-git commit",
          "Then create PR: ai-git pr",
        ],
      );
    }
    process.exit(1);
  }

  // ベースブランチとの同期（コンフリクトチェック・マージ）
  await syncWithBaseBranch(baseBranch, currentBranch, language);

  // ブランチをプッシュ
  pushBranchForPR(currentBranch, language);

  console.log(
    `🤖 PR説明文を生成中... (${baseBranch}...${currentBranch}) [compact summary input]`,
  );

  const description = await generatePRDescription(baseBranch, language, getBranchDiff);

  console.log(`\n📝 Generated PR:\n`);
  console.log(`  Title: ${extractPRTitle(description)}`);
  console.log();
  stripTitleLine(description)
    .split("\n")
    .forEach((line) => {
      console.log(`  ${line}`);
    });
  console.log();

  const answer = await askUser(
    "Create PR with this description? [y/n/e(edit)]: ",
  );

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
  } else if (answer !== "y" && answer !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  const fallbackURL = getPullRequestURL(currentBranch);
  createPR(finalDescription, baseBranch, fallbackURL, language, extractPRTitle, stripTitleLine);
  console.log(`\n✅ PR created successfully!`);
}
