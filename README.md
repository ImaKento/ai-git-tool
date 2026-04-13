# ai-git-tool

Groq API を使って、ステージ済み差分からコミットメッセージと PR 説明文を自動生成する TypeScript 製 CLI です。

## 特徴

- Conventional Commits 形式のコミットメッセージを自動生成
- `gh` と連携した PR 説明文の生成と PR 作成
- 変更差分からのブランチ名推定（`ai-git checkout`）
- 日本語 / 英語の出力切り替え（ワンショット / 永続設定）
- `--no-add` による「手動でステージした差分のみ」の運用に対応

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

### 最短クイックスタート

```bash
# 1) API キーを設定
export GROQ_API_KEY="your_api_key"

# 2) 変更をコミット（必要なら自動で git add .）
ai-git commit

# 3) PR を作成
ai-git pr
```

`ai-git commit` はレビュー前の小さなコミット作成、`ai-git pr` はPR本文作成とPR公開までをまとめて行いたいときに便利です。

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

補足:

- 件名（1行目）は `<type>(<scope>): <description>` を優先
- 本文は WHAT / WHY を中心に 3〜5 行の箇条書き
- 生成内容が期待と違う場合は `e` で編集して確定可能

### コミット & プッシュ

```bash
ai-git push
```

`git add .` → AI によるコミットメッセージ生成 → コミット → `git push` を一括で実行します。

- upstream が未設定の場合は `git push -u origin <branch>` で自動設定
- PR は作成しません（PR を作りたい場合は `ai-git pr` を使用）

確認プロンプトで操作を選択できます。

| 入力 | 動作 |
|------|------|
| `y` | そのままコミット & プッシュ |
| `n` | 中止 |
| `e` | エディタで編集してからコミット & プッシュ |

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

補足:

- ベースブランチ（通常 `main`）との差分コミットがない場合、PR は作成できません
- 未コミット変更は PR に含まれないため、必要な変更は先にコミットしてください

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

命名ルール（概要）:

- 形式: `<type>/<topic>`
- `type`: `feat` / `fix` / `docs` / `chore` / `refactor` / `test` / `style`
- `topic`: ファイル名や差分トークンから推定した kebab-case

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

## 推奨ワークフロー

日々の開発で使いやすい流れです。

1. 変更を実装する
2. `ai-git commit` でコミットメッセージを生成してコミット
3. 必要に応じて 2 を繰り返す
4. `ai-git pr` で PR 説明文を生成し、そのまま PR を作成

大きな差分は一度に処理せず、意味のある単位でコミットを分割すると精度が上がります。

## 開発

```bash
npm install
npm run build
npm link   # どの Git リポジトリでも ai-git が使えるようになります
```

```bash
npm run dev
```

### ローカルCLIとして使う

`npm link` 後に、任意の Git リポジトリで `ai-git` コマンドを利用できます。  
挙動確認時は別ディレクトリで検証用リポジトリを作ると安全です。

## トラブルシューティング

| エラー | 対処 |
|--------|------|
| `No staged changes found.` | `git add` してから実行 |
| `GROQ_API_KEY が未設定です` | `GROQ_API_KEY` を設定 |
| `413 Request too large` / TPM 超過 | `git add -p` でステージを分割 |
| `GraphQL: No commits between ...` | ベースブランチとの差分コミットがないため、先にコミットしてから `ai-git pr` を実行 |
| `GitHub CLI authentication is required` | `gh auth login` を実行するか `GH_TOKEN` を設定 |

## FAQ

### `commit` と `push` の違いは？

- `ai-git commit`: コミットまで実行
- `ai-git push`: コミット後に `git push` まで実行

### 生成結果がしっくりこないときは？

確認プロンプトで `e` を選ぶとエディタで内容を調整できます。  
また、ステージ対象を絞る（`git add -p`）とメッセージ品質が安定します。

### 英語で固定したい

```bash
ai-git --set-lang en
```

日本語に戻す場合:

```bash
ai-git --set-lang ja
```
