# ai-git-tool

Groq API を使って、ステージ済み差分からコミットメッセージと PR 説明文を自動生成する TypeScript 製 CLI です。

## セットアップ

```bash
npm install -g ai-git-tool
```

### 環境変数

API キーの取得先: [Groq Console](https://console.groq.com/keys)

**macOS / Linux (bash/zsh):**

```bash
export GROQ_API_KEY="your_api_key"
```

永続化する場合は `~/.bashrc` や `~/.zshrc` に追記してください。

**Windows (コマンドプロンプト):**

```cmd
setx GROQ_API_KEY "your_api_key"
```

**Windows (PowerShell):**

```powershell
[System.Environment]::SetEnvironmentVariable("GROQ_API_KEY", "your_api_key", "User")
```

> `setx` / `SetEnvironmentVariable` はユーザー環境変数として永続保存されます。設定後は**ターミナルを再起動**してください。

**Windows (Git Bash):**

```bash
echo 'export GROQ_API_KEY="your_api_key"' >> ~/.bashrc
source ~/.bashrc
```

任意でモデル指定も可能です（デフォルト: `llama-3.1-8b-instant`）。

```bash
# macOS / Linux / Git Bash
export GROQ_MODEL="llama-3.3-70b-versatile"

# Windows コマンドプロンプト
setx GROQ_MODEL "llama-3.3-70b-versatile"
```

## 使い方

### コミットメッセージ生成

```bash
ai-git commit
```

デフォルトで `git add .` を実行してからコミットメッセージを生成します。

```bash
# 手動でステージした差分のみ使う
ai-git commit --no-add
```

確認プロンプトで操作を選択できます。

| 入力 | 動作 |
|------|------|
| `y` | そのままコミット |
| `n` | 中止 |
| `e` | エディタで編集してからコミット |

**生成されるコミットメッセージの形式（Conventional Commits）:**

```
feat(auth): Google ログインを追加する

- GoogleAuthProvider の設定を auth.ts に追加する
- トークン期限切れ時の更新処理を追加する
- ネットワーク障害時のエラーハンドリングを追加する
```

### PR 作成

```bash
ai-git pr
```

自動的に以下を実行します。

- ブランチがまだ push されていない場合: `git push -u origin <branch>`
- ローカルに新しいコミットがある場合: `git push`
- PR 説明文を生成して PR を作成

確認プロンプトで操作を選択できます。

| 入力 | 動作 |
|------|------|
| `y` | PR を作成 |
| `n` | 中止 |
| `e` | エディタで編集してから作成 |

**生成される PR 説明文の形式:**

```markdown
## Summary
変更の全体像を 2〜3 文で説明

## Changes
- 具体的な変更内容（3〜7 項目）

## Test plan
- テスト・確認方法（2〜4 項目）
```

**前提条件:**

- GitHub CLI (`gh`) がインストール済み ([インストール方法](https://cli.github.com/))
- `gh auth login` で認証済み

### ブランチ作成（自動命名）

変更差分（ステージ済み + 未ステージ）からブランチ名を推定して作成します。

```bash
ai-git checkout
```

命名例:

```
feat/google-login
fix/api-error-handling
docs/readme-update
```

### 言語設定

デフォルト言語は日本語です。

```bash
# 今回だけ英語で生成
ai-git commit --lang en
ai-git pr --lang en

# デフォルト言語を永続化
ai-git --set-lang en
ai-git --set-lang ja
```

### ヘルプ

```bash
ai-git --help
```

## 開発

```bash
npm install
npm run build
npm link   # どの Git リポジトリでも ai-git が使えるようになります
```

```bash
npm run dev
```

## トラブルシューティング

| エラー | 対処 |
|--------|------|
| `No staged changes found.` | `git add` してから実行 |
| `GROQ_API_KEY が未設定です` | `GROQ_API_KEY` を設定 |
| `413 Request too large` / TPM 超過 | `git add -p` でステージを分割 |
