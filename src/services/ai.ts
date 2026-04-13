import OpenAI from "openai";
import type { Language } from "../types.js";
import {
  showFriendlyError,
  handleGroqError,
  isRequestTooLargeError,
} from "../utils/errors.js";
import { truncateByChars } from "../utils/text.js";
import { getChangedFiles, getCombinedDiff } from "../utils/git.js";

const defaultGroqModel = "llama-3.3-70b-versatile";
const COMMIT_DIFF_COMPACT_CHARS = 3500;
const PR_COMMITS_COMPACT_CHARS = 1800;
const PR_DIFF_COMPACT_CHARS = 3500;

/**
 * Groq クライアントを取得
 */
export function getGroqClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    showFriendlyError(
      "GROQ_API_KEY が未設定です",
      "AI 機能を使用するには Groq API キーが必要です",
      [
        "Groq にサインアップ（無料）: https://console.groq.com/",
        "API キーを取得: https://console.groq.com/keys",
        "環境変数に設定:",
        '  - 一時的: export GROQ_API_KEY="gsk_..."',
        "  - 永続的: ~/.bashrc や ~/.zshrc に上記を追加",
      ],
      [
        "API キー設定後に ai-git commit を実行",
        "API キー設定後に ai-git pr を実行",
      ],
    );
    process.exit(1);
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

/**
 * AI でテキストを生成
 */
export async function generateText(prompt: string): Promise<string> {
  const client = getGroqClient();
  const model = process.env.GROQ_MODEL || defaultGroqModel;
  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content?.trim() || "";
}

/**
 * コミットメッセージ生成用プロンプトを構築
 */
function buildCommitPrompt(diff: string, lang: Language): string {
  if (lang === "ja") {
    return `あなたは git のコミットメッセージ作成の専門家です。
次の git diff を注意深く分析し、Conventional Commits 形式の詳細コミットメッセージを生成してください。

重要: diff の内容を正確に読み取り、実際に何が変更されたかを理解してください。
変更されたファイル名、追加/削除された関数名、変更の目的を特定してください。

ルール:
- 1行目: <type>(<optional scope>): <short description>（72文字以内）
  * type は実際の変更内容に基づいて選択（feat, fix, docs, refactor, test, chore など）
  * scope は変更の影響範囲（例: error-handling, ui, api）
- 2行目は空行
- 本文は "- " で始まる箇条書き
- 箇条書きは 3-5 行で、具体的な変更内容を記述
- WHAT（何を変更したか）と WHY（なぜ変更したか）を書く
- HOW（どうやって実装したか）は書かない
- 命令形を使う（「追加する」「修正する」など）
- 出力はコミットメッセージ本文のみ（説明文は不要）
- 説明文は日本語にする

出力例:
feat(auth): Google ログインを追加する

- auth.ts に GoogleAuthProvider の設定を追加する
- トークン期限切れ時の更新処理を追加する
- ネットワーク障害時のエラーハンドリングを追加する

Git diff:
${diff}`;
  }

  return `You are an expert at writing git commit messages.
Carefully analyze the following git diff and generate a detailed commit message in Conventional Commits format.

IMPORTANT: Read the diff content accurately and understand what was actually changed.
Identify changed file names, added/removed function names, and the purpose of the changes.

Rules:
- First line: <type>(<optional scope>): <short description> (max 72 chars)
  * Choose type based on actual changes (feat, fix, docs, refactor, test, chore, etc.)
  * Scope should reflect the area of impact (e.g., error-handling, ui, api)
- Blank line after the first line
- Body: bullet points starting with "- " describing specific changes
- 3-5 bullet points explaining WHAT was changed and WHY
- Do NOT explain HOW it was implemented
- Use imperative mood ("add" not "added")
- Output ONLY the commit message, nothing else

Example:
feat(auth): add Google login with Firebase Auth

- Add GoogleAuthProvider setup in auth.ts
- Handle token refresh on expiry
- Add error handling for network failures

Git diff:
${diff}`;
}

/**
 * ファイルパスだけのような内容かチェック
 */
function looksLikePathOnly(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const hasPathToken = normalized.includes("/") || normalized.includes(".");
  return hasPathToken && /^[a-z0-9/_\-.]+$/.test(normalized);
}

/**
 * フォールバックのサブジェクト行を生成
 */
function buildFallbackSubjectLine(diff: string, lang: Language): string {
  const files = getChangedFiles();
  const type = inferBranchType(files, diff);
  const rawTopic = inferTopic(files, diff);
  const topic = rawTopic ? rawTopic.replace(/-/g, " ") : "";

  if (lang === "ja") {
    const description = topic
      ? `${topic} の変更意図を分かりやすく整理する`
      : "変更意図が伝わるように更新内容を整理する";
    return `${type}: ${description}`;
  }

  const description = topic
    ? `clarify the intent behind ${topic} changes`
    : "clarify update intent in one clear sentence";
  return `${type}: ${description}`;
}

/**
 * フォールバックのコミットメッセージを生成
 */
function buildFallbackCommitMessage(diff: string, lang: Language): string {
  const subject = buildFallbackSubjectLine(diff, lang);
  if (lang === "ja") {
    return `${subject}\n\n- 差分の主目的を明確にし、変更理由が伝わる形に整える`;
  }
  return `${subject}\n\n- Clarify the main change intent so the reason is easy to understand`;
}

/**
 * AI が生成したコミットメッセージを正規化
 */
function normalizeGeneratedCommitMessage(
  raw: string,
  diff: string,
  lang: Language,
): string {
  const lines = raw
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .filter(
      (_, idx, arr) => !(idx > 0 && arr[idx - 1] === "" && arr[idx] === ""),
    );

  if (lines.length === 0) {
    return buildFallbackCommitMessage(diff, lang);
  }

  const subjectLine = lines[0]?.trim() || "";
  const conventionalMatch = /^[a-z]+(\([^)]+\))?:\s+(.+)$/.exec(subjectLine);
  const hasConventionalPrefix = Boolean(conventionalMatch);
  const shortDescription = conventionalMatch?.[2]?.trim() || subjectLine;

  if (
    !hasConventionalPrefix ||
    looksLikePathOnly(shortDescription) ||
    shortDescription.length < 8
  ) {
    lines[0] = buildFallbackSubjectLine(diff, lang);
  }

  return lines.join("\n").trim();
}

/**
 * git diff から AI を使ってコミットメッセージを生成
 */
export async function generateCommitMessage(
  diff: string,
  language: Language,
): Promise<string> {
  const inputDiff = truncateByChars(diff, COMMIT_DIFF_COMPACT_CHARS);
  const prompt = buildCommitPrompt(inputDiff, language);
  try {
    const raw = await generateText(prompt);
    return normalizeGeneratedCommitMessage(raw, diff, language);
  } catch (error) {
    if (isRequestTooLargeError(error)) {
      const smallerDiff = truncateByChars(diff, 1800);
      const retryRaw = await generateText(
        buildCommitPrompt(smallerDiff, language),
      );
      return normalizeGeneratedCommitMessage(retryRaw, diff, language);
    }
    handleGroqError(error);
    process.exit(1);
  }
}

/**
 * PR 説明文生成用プロンプトを構築
 */
function buildPRPrompt(commits: string, diff: string, lang: Language): string {
  if (lang === "ja") {
    return `あなたは GitHub の Pull Request 作成の専門家です。
次のコミット履歴と差分から、PR のタイトルと説明文を生成してください。

出力フォーマット（必ずこの順番で出力してください）:
1行目: Title: <Conventional Commits 形式のタイトル（72文字以内、日本語で）>
2行目: 空行
3行目以降: PR 説明文（以下の形式）

説明文のルール:
- ## Summary の後は改行し、次の行から概要を 1-2 文で説明
- ## Changes の後は改行し、次の行から "- " で始まる箇条書き（3-7個）で具体的な変更内容
- ## Test plan の後は改行し、次の行から "- " で始まるテスト方法の箇条書き（2-4個）
- 命令形を使う
- WHATとWHYを重視し、HOWは最小限に
- 出力はタイトルとPR説明文のみ（余計な説明は不要）

出力例:
Title: feat: push サブコマンドを追加する

## Summary
コミット後に自動でリモートにプッシュする機能を追加しました。

## Changes
- push サブコマンドを追加し、コミットとプッシュを一括実行できるようにする
- upstream が未設定の場合は自動で設定する機能を追加する
- エラーハンドリングを強化する

## Test plan
- ai-git push を実行してコミットとプッシュが正常に動作するか確認する
- upstream が未設定の状態でも正しくプッシュされるか確認する

コミット履歴:
${commits}

変更差分:
${diff}`;
  }

  return `You are an expert at writing GitHub Pull Request descriptions.
Generate a PR title and description from the following commit history and diff.

Output format (in this exact order):
Line 1: Title: <Conventional Commits title, max 72 chars>
Line 2: empty line
Line 3+: PR description in the following format

Description rules:
- ## Summary should be followed by a line break, then 1-2 sentences explaining the overall change
- ## Changes should be followed by a line break, then bullet points (3-7 items) with "- " prefix detailing specific changes
- ## Test plan should be followed by a line break, then bullet points (2-4 items) describing how to test
- Use imperative mood
- Focus on WHAT and WHY, minimize HOW
- Output ONLY the title line and PR description, no extra explanation

Output example:
Title: feat: add push subcommand

## Summary
Added a new push subcommand that automatically commits and pushes changes to remote.

## Changes
- Add push subcommand to execute commit and push in one command
- Add automatic upstream setup when not configured
- Improve error handling for push operations

## Test plan
- Run ai-git push and verify commit and push work correctly
- Verify it works correctly when upstream is not set

Commit history:
${commits}

Diff:
${diff}`;
}

/**
 * PR のタイトルを抽出
 */
export function extractPRTitle(raw: string): string {
  const firstLine = raw.split("\n")[0]?.trim() ?? "";
  const titleMatch = /^Title:\s*(.+)$/i.exec(firstLine);
  if (titleMatch?.[1]) {
    return titleMatch[1].trim();
  }

  const lines = raw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  const summaryIdx = lines.findIndex((l) =>
    l.toLowerCase().startsWith("## summary"),
  );
  let candidate =
    summaryIdx >= 0
      ? (lines.slice(summaryIdx + 1).find((l) => !l.startsWith("##")) ?? "")
      : (lines.find((l) => !l.startsWith("#") && !l.startsWith("-")) ?? "");

  candidate = candidate
    .replace(/^this pull request\s+(is|does)\s*/i, "")
    .replace(/^この\s*pull request\s*は、?/i, "")
    .replace(/^このprは、?/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentenceCut = candidate.search(/[。.!?]/);
  if (sentenceCut > 0) {
    candidate = candidate.slice(0, sentenceCut);
  }

  return candidate || "Update project changes";
}

/**
 * Title 行を除去
 */
export function stripTitleLine(raw: string): string {
  const lines = raw.split("\n");
  if (/^Title:\s*/i.test(lines[0]?.trim() ?? "")) {
    return lines
      .slice(lines[1]?.trim() === "" ? 2 : 1)
      .join("\n")
      .trimStart();
  }
  return raw;
}

/**
 * PR 説明文を生成
 */
export async function generatePRDescription(
  baseBranch: string,
  language: Language,
  getBranchDiff: (
    baseBranch: string,
    language: Language,
  ) => { commits: string; diff: string },
): Promise<string> {
  const { commits, diff } = getBranchDiff(baseBranch, language);
  const inputCommits = truncateByChars(commits, PR_COMMITS_COMPACT_CHARS);
  const inputDiff = truncateByChars(diff, PR_DIFF_COMPACT_CHARS);
  const prompt = buildPRPrompt(inputCommits, inputDiff, language);

  try {
    return await generateText(prompt);
  } catch (error) {
    if (isRequestTooLargeError(error)) {
      const compactCommits = truncateByChars(commits, 1200);
      const compactDiff = truncateByChars(diff, 2200);
      const compactPrompt = buildPRPrompt(
        compactCommits,
        compactDiff,
        language,
      );

      if (language === "ja") {
        console.log(
          "ℹ️ 入力サイズが大きいため、差分を要約モードにして再試行します...",
        );
      } else {
        console.log(
          "ℹ️ Input is too large. Retrying with compact diff summary...",
        );
      }

      try {
        return await generateText(compactPrompt);
      } catch (retryError) {
        handleGroqError(retryError);
        process.exit(1);
      }
    }

    handleGroqError(error);
    process.exit(1);
  }
}

// ブランチ名推測用のヘルパー関数

function inferBranchType(files: string[], diff: string): string {
  const lowerFiles = files.map((f) => f.toLowerCase());
  const lowerDiff = diff.toLowerCase();

  if (lowerFiles.length > 0 && lowerFiles.every((f) => f.endsWith(".md"))) {
    return "docs";
  }
  if (
    lowerFiles.some((f) => f.includes("readme") || f.endsWith(".md")) &&
    lowerFiles.length <= 2
  ) {
    return "docs";
  }
  if (
    lowerFiles.some((f) => f.includes("package.json") || f.includes("lock")) &&
    lowerFiles.length <= 2
  ) {
    return "chore";
  }
  if (
    lowerDiff.includes("fix") ||
    lowerDiff.includes("bug") ||
    lowerDiff.includes("error")
  ) {
    return "fix";
  }
  return "feat";
}

function isGoodTopicToken(token: string, stopWords: Set<string>): boolean {
  if (token.length < 3) {
    return false;
  }
  if (stopWords.has(token)) {
    return false;
  }
  if (/^[a-f0-9]{6,}$/.test(token)) {
    return false;
  }
  if (/^\d+$/.test(token)) {
    return false;
  }
  return true;
}

function sanitizeBranchPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferTopic(files: string[], diff: string): string {
  const stopWords = new Set([
    "src",
    "dist",
    "index",
    "readme",
    "package",
    "lock",
    "json",
    "ts",
    "js",
    "md",
    "diff",
    "added",
    "removed",
    "file",
    "files",
    "change",
    "changes",
    "update",
    "updated",
    "line",
    "lines",
  ]);

  const fileTokens = files
    .flatMap((f) => f.split(/[\/._-]+/))
    .map((v) => v.toLowerCase())
    .filter((v) => isGoodTopicToken(v, stopWords));

  const diffTokens = diff
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((v) => isGoodTopicToken(v, stopWords))
    .slice(0, 20);

  const tokens = [...fileTokens, ...diffTokens]
    .map((v) => sanitizeBranchPart(v))
    .filter(Boolean);

  if (tokens.length === 0) {
    return "";
  }

  const unique = Array.from(new Set(tokens));
  return unique.slice(0, 3).join("-");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * AI でブランチ名を提案
 */
export async function suggestBranchNameWithAI(
  files: string[],
  diff: string,
): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }

  const compactFiles = files.slice(0, 30).join("\n");
  const compactDiff = truncateByChars(diff, 2800);
  const prompt = `You are an expert at naming git branches.
Generate exactly one branch name from the following changes.

Rules:
- Output only branch name, nothing else
- Format: <type>/<slug>
- type must be one of: feat, fix, docs, chore, refactor, test, style
- slug must use kebab-case
- Prefer meaningful feature intent over noisy token names
- If changes look like new feature or command addition, prefer feat

Changed files:
${compactFiles}

Diff:
${compactDiff}`;

  try {
    const raw = await generateText(prompt);
    return normalizeBranchCandidate(raw);
  } catch {
    return null;
  }
}

function normalizeBranchCandidate(raw: string): string | null {
  const firstLine = raw.split("\n")[0]?.trim().toLowerCase() || "";
  const cleaned = firstLine.replace(/[`"' ]/g, "");
  const normalized = cleaned.replace(/^feature\//, "feat/");
  const [head, ...tail] = normalized.split("/");
  if (!head || tail.length === 0) {
    return null;
  }
  const validTypes = new Set([
    "feat",
    "fix",
    "docs",
    "chore",
    "refactor",
    "test",
    "style",
  ]);
  if (!validTypes.has(head)) {
    return null;
  }
  const slug = sanitizeBranchPart(tail.join("-"));
  if (!slug || slug.length < 3) {
    return null;
  }
  return `${head}/${slug}`;
}

/**
 * ブランチ名を提案（AI またはヒューリスティック）
 */
export async function suggestBranchName(): Promise<string> {
  const files = getChangedFiles();
  const diff = getCombinedDiff();
  const fromAI = await suggestBranchNameWithAI(files, diff);
  if (fromAI) {
    return fromAI;
  }
  const type = inferBranchType(files, diff);
  const topic = inferTopic(files, diff);

  if (!topic) {
    return `${type}/update-${randomSuffix()}`;
  }
  return `${type}/${topic}`;
}
