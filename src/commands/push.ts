import type { Language } from "../types.js";
import { runCommitCommand } from "./commit.js";
import { pushCurrentBranch, getCurrentBranch } from "../utils/git.js";

/**
 * push コマンドの実行
 */
export async function runPushCommand(
  language: Language,
  noAdd: boolean,
): Promise<void> {
  await runCommitCommand(language, noAdd);

  const currentBranch = getCurrentBranch();
  pushCurrentBranch(currentBranch);

  console.log(`\n✅ Push 完了!`);
}
