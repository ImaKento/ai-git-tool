import { execSync } from "child_process";

/**
 * Git リポジトリかどうかを確認
 */
export function checkIfGitRepository(): void {
  try {
    execSync("git rev-parse --git-dir", { stdio: "pipe" });
  } catch {
    console.error("❌ これは Git リポジトリではありません。");
    console.error("");
    console.error("💡 次の手順を試してください:");
    console.error("   1. Git リポジトリを初期化する:");
    console.error("      git init");
    console.error("   2. または、既存のリポジトリに移動する:");
    console.error("      cd /path/to/your/repository");
    process.exit(1);
  }
}

/**
 * 親切なエラーメッセージを表示
 */
export function showFriendlyError(
  title: string,
  reason: string,
  solutions: string[],
  nextSteps?: string[],
): void {
  console.error(`❌ ${title}`);
  console.error("");
  console.error(`📋 原因: ${reason}`);
  console.error("");
  console.error("💡 解決方法:");
  solutions.forEach((solution, idx) => {
    console.error(`   ${idx + 1}. ${solution}`);
  });

  if (nextSteps && nextSteps.length > 0) {
    console.error("");
    console.error("🚀 その後、以下のコマンドが使えます:");
    nextSteps.forEach((step) => {
      console.error(`   - ${step}`);
    });
  }
}

/**
 * Groq API エラーのハンドリング
 */
export function handleGroqError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate")
  ) {
    console.error(
      "❌ Groq API の利用上限に達しました（429: quota/rate limit）。",
    );
    console.error("   - 少し待って再実行してください");
    console.error("   - https://console.groq.com で利用枠を確認してください");
    console.error("   - 必要なら別プロジェクトの API キーを利用してください");
    return;
  }

  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("api key")
  ) {
    console.error(
      "❌ Groq API 認証エラーです。GROQ_API_KEY を確認してください。",
    );
    console.error("   取得先: https://console.groq.com/keys");
    return;
  }

  console.error("❌ Groq API 呼び出しに失敗しました。");
  console.error(`   詳細: ${message}`);
}

/**
 * リクエストが大きすぎるエラーかどうかを判定
 */
export function isRequestTooLargeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("413") ||
    lower.includes("request too large") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm")
  );
}
