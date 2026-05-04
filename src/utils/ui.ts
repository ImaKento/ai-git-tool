import * as readline from "readline";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync, spawnSync } from "child_process";

/**
 * ユーザーに質問して回答を取得
 */
export function askUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * エディタでテキストを編集
 */
type EditorOption = {
  label: string;
  commandLine: string;
};

export async function editInEditor(message: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `commit-msg-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, message, "utf-8");

  const editor = await selectEditor();
  const { command, args } = parseCommand(editor);
  const result = spawnSync(command, [...args, tmpFile], { stdio: "inherit" });

  if (result.error) {
    console.error(`Error: Failed to open editor: ${result.error.message}`);
    process.exit(1);
  }

  const edited = fs.readFileSync(tmpFile, "utf-8").trim();
  fs.unlinkSync(tmpFile);
  return edited;
}

async function selectEditor(): Promise<string> {
  const options = getAvailableEditors();

  if (options.length === 0) {
    console.error("Error: No supported editor found.");
    console.error("Install VS Code, Vim, or set EDITOR to an available editor.");
    process.exit(1);
  }

  if (options.length === 1) {
    return options[0].commandLine;
  }

  console.log("\nAvailable editors:");
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option.label}`);
  });

  while (true) {
    const answer = await askUser("Select editor: ");
    const selected = Number.parseInt(answer, 10);

    if (Number.isInteger(selected) && selected >= 1 && selected <= options.length) {
      return options[selected - 1].commandLine;
    }

    console.log(`Please enter a number from 1 to ${options.length}.`);
  }
}

function getAvailableEditors(): EditorOption[] {
  const candidates: EditorOption[] = [
    ...getConfiguredEditors(),
    { label: "VS Code", commandLine: "code --wait" },
    { label: "Vim", commandLine: "vim" },
    { label: "Vi", commandLine: "vi" },
  ];

  if (process.platform === "win32") {
    candidates.push({ label: "Notepad", commandLine: "notepad" });
  } else {
    candidates.push({ label: "Nano", commandLine: "nano" });
  }

  return dedupeEditors(candidates).filter((editor) =>
    commandExists(parseCommand(editor.commandLine).command)
  );
}

function getConfiguredEditors(): EditorOption[] {
  const editors: EditorOption[] = [];

  if (process.env.VISUAL) {
    editors.push({
      label: `VISUAL (${process.env.VISUAL})`,
      commandLine: process.env.VISUAL,
    });
  }

  if (process.env.EDITOR) {
    editors.push({
      label: `EDITOR (${process.env.EDITOR})`,
      commandLine: process.env.EDITOR,
    });
  }

  try {
    const gitEditor = execSync("git config --get core.editor", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (gitEditor) {
      editors.push({
        label: `Git editor (${gitEditor})`,
        commandLine: gitEditor,
      });
    }
  } catch {
    // No git editor configured.
  }

  return editors;
}

function dedupeEditors(editors: EditorOption[]): EditorOption[] {
  const seen = new Set<string>();
  const deduped: EditorOption[] = [];

  for (const editor of editors) {
    const key = editor.commandLine.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(editor);
    }
  }

  return deduped;
}

function commandExists(command: string): boolean {
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    return fs.existsSync(command);
  }

  const lookupCommand =
    process.platform === "win32" ? `where.exe ${command}` : `command -v ${command}`;

  try {
    execSync(lookupCommand, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function parseCommand(commandLine: string): { command: string; args: string[] } {
  const parts = commandLine.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const [command = commandLine, ...args] = parts.map((part) =>
    part.replace(/^["']|["']$/g, "")
  );

  return { command, args };
}
