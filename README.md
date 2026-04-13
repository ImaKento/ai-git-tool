# ai-git-tool

AIを使って、ステージ済み差分からコミットメッセージと PR 説明文を自動生成する TypeScript 製 CLI です。

<video src="https://github.com/user-attachments/assets/c3826580-eb80-409a-b3fc-cc19f006cceb" />　　

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

任意でモデル指定も可能です（デフォルト: `Llama 3.3 70B Versatile`）。

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

| 入力 | 動作                           |
| ---- | ------------------------------ |
| `y`  | そのままコミット               |
| `n`  | 中止                           |
| `e`  | エディタで編集してからコミット |

**生成されるコミットメッセージの形式（Conventional Commits）:**

```
feat(auth): Google ログインを追加する

- GoogleAuthProvider の設定を auth.ts に追加する
- トークン期限切れ時の更新処理を追加する
- ネットワーク障害時のエラーハンドリングを追加する
```

### コミット & プッシュ

```bash
ai-git push
```

`git add .` → AI によるコミットメッセージ生成 → コミット → `git push` を一括で実行します。

- upstream が未設定の場合は `git push -u origin <branch>` で自動設定
- PR は作成しません（PR を作りたい場合は `ai-git pr` を使用）

確認プロンプトで操作を選択できます。

| 入力 | 動作                                      |
| ---- | ----------------------------------------- |
| `y`  | そのままコミット & プッシュ               |
| `n`  | 中止                                      |
| `e`  | エディタで編集してからコミット & プッシュ |

```bash
# ステージ済みの差分のみ使う
ai-git push --no-add
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

| 入力 | 動作                       |
| ---- | -------------------------- |
| `y`  | PR を作成                  |
| `n`  | 中止                       |
| `e`  | エディタで編集してから作成 |

**生成される PR 説明文の形式:**

```markdown
## Summary

変更の全体像を 1〜2 文で説明

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

### エラーメッセージについて

ai-git は Git 初心者にも優しいエラーメッセージを表示します。エラーが発生した場合、以下の情報が表示されます：

- **何が起こったか**（エラーの内容）
- **なぜ起こったか**（原因）
- **どうすればいいか**（解決方法）
- **ai-git のどのコマンドが使えるか**（次のステップ）

### よくあるエラーと対処法

| エラー                                         | 原因                                       | 対処                                                                    |
| ---------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `ステージされた変更が見つかりません`           | コミットする変更がステージングエリアにない | `git add .` でステージ、または `ai-git push` を使用                     |
| `GROQ_API_KEY が未設定です`                    | AI 機能に必要な API キーが設定されていない | [Groq Console](https://console.groq.com/keys) で API キーを取得して設定 |
| `これは Git リポジトリではありません`          | Git が初期化されていないディレクトリで実行 | `git init` で初期化、または Git リポジトリに移動                        |
| `GitHub CLI (gh) がインストールされていません` | PR 作成に必要な gh コマンドがない          | [GitHub CLI](https://cli.github.com/) をインストール                    |
| `GitHub CLI の認証が必要です`                  | GitHub にログインしていない                | `gh auth login` で認証                                                  |
| `ベースブランチを検出できませんでした`         | main/master/develop ブランチが存在しない   | リモートから取得: `git fetch origin`                                    |
| `413 Request too large` / TPM 超過             | 差分が大きすぎる、またはレート制限         | 自動で縮小して再試行されます。それでも失敗する場合は少し待つ            |

### Git の基本操作

ai-git を使う前に、以下の Git コマンドを覚えておくと便利です：

```bash
# 現在の状態を確認
git status

# 変更をステージング
git add <ファイル名>    # 特定のファイルだけ
git add .              # すべての変更

# コミット履歴を確認
git log --oneline

# ブランチの確認
git branch -a

# リモートの確認
git remote -v
```

### 推奨ワークフロー

Git 初心者の方は、以下の流れで使うのがおすすめです：

1. **変更を加える** - ファイルを編集
2. **状態を確認** - `git status` で変更を確認
3. **コミット** - `ai-git commit` または `ai-git push`
4. **PR 作成** - `ai-git pr`（必要に応じて）
