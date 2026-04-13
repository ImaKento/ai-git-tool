import { execSync } from "child_process";
import { branchExists } from "../utils/git.js";

/**
 * ブランチパーツをサニタイズ
 */
function sanitizeBranchPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * ランダムサフィックスを生成
 */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * 利用可能なブランチ名を確保
 */
export function ensureAvailableBranchName(baseName: string): string {
  const [headRaw, ...tailRaw] = baseName.split("/");
  const head = sanitizeBranchPart(headRaw || "feat");
  const tail = sanitizeBranchPart(tailRaw.join("-") || `update-${randomSuffix()}`);
  const normalized = `${head || "feat"}/${tail}`;

  if (!branchExists(normalized)) {
    return normalized;
  }

  let i = 2;
  while (branchExists(`${normalized}-${i}`)) {
    i += 1;
  }
  return `${normalized}-${i}`;
}
