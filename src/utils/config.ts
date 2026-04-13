import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Language, Config } from "../types.js";

const CONFIG_DIR = path.join(os.homedir(), ".ai-commit");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

/**
 * 言語文字列をパース
 */
export function parseLanguage(value?: string): Language | null {
  if (!value) {
    return null;
  }
  if (value === "ja" || value === "en") {
    return value;
  }
  return null;
}

/**
 * 設定ファイルから言語設定を読み込む
 */
export function loadConfig(): Config | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { language?: string };
    const lang = parseLanguage(parsed.language);
    if (!lang) {
      return null;
    }
    return { language: lang };
  } catch {
    return null;
  }
}

/**
 * 設定ファイルに言語設定を保存
 */
export function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    CONFIG_PATH,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf-8",
  );
}

/**
 * 言語設定を解決（フラグ → 設定ファイル → デフォルト）
 */
export function resolveLanguage(langValue?: string): Language {
  const fromFlag = parseLanguage(langValue);
  if (langValue && !fromFlag) {
    console.error("Error: --lang は ja または en を指定してください。");
    process.exit(1);
  }
  if (fromFlag) {
    return fromFlag;
  }

  const config = loadConfig();
  return config?.language ?? "ja";
}
