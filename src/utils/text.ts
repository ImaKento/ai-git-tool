/**
 * テキストを指定文字数で切り詰める
 */
export function truncateByChars(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input;
  }
  return `${input.slice(0, maxChars)}\n\n... (truncated)`;
}

/**
 * オプション値を取得
 */
export function getOptionValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx === -1) {
    return undefined;
  }
  return argv[idx + 1];
}
