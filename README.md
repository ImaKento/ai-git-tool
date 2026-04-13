# ai-git

Gemini API を使って、ステージ済み差分からコミットメッセージと PR 説明文を自動生成する TypeScript 製 CLI です。

## 必要環境

- Node.js `18` 以上
- `git`
- Gemini API キー（`GEMINI_API_KEY`）

## セットアップ

```bash
npm install
npm run build
npm link
```

`npm link` 後は、どの Git リポジトリでも `ai-git` が使えます。

## 環境変数

```bash
export GEMINI_API_KEY="your_api_key"
```

API キーの取得先: [Google AI Studio](https://aistudio.google.com/apikey)

## 使い方

### コミットメッセージ生成

1. 先に変更をステージ

```bash
git add .
```

2. コミットメッセージを生成

```bash
# 通常（タイトル + 箇条書き本文）
ai-git commit

# 短文（1行の Conventional Commits）
ai-git commit --short
```

デフォルト言語は日本語です。

```bash
# 今回だけ英語で生成
ai-git commit --lang en

# デフォルト言語を永続化
ai-git --set-lang en
ai-git --set-lang ja
```

3. 確認プロンプトで選択

- `y`: そのままコミット
- `n`: 中止
- `e`: エディタで編集してからコミット

### PR作成

1. ブランチで作業してコミット

```bash
git checkout -b feature/new-feature
# ... 開発作業 ...
git add .
ai-git commit
```

2. PR説明文を生成してPR作成

```bash
ai-git pr

# 言語指定も可能
ai-git pr --lang en
```

`ai-git pr` は自動的に以下を実行します:
- ブランチがまだpushされていない場合、`git push -u origin <branch>` を実行
- ローカルに新しいコミットがある場合、`git push` を実行
- PR説明文を生成してPRを作成

3. 確認プロンプトで選択

- `y`: PRを作成
- `n`: 中止
- `e`: エディタで編集してから作成

**前提条件:**
- GitHub CLI (`gh`) がインストール済み ([インストール方法](https://cli.github.com/))
- `gh auth login` で認証済み

**生成されるPR説明文のフォーマット:**
- ## Summary: 変更の概要（2-3文）
- ## Changes: 具体的な変更内容（箇条書き）
- ## Test plan: テスト方法（箇条書き）

## 開発

```bash
# TypeScript を直接実行
npm run dev

# ビルド
npm run build
```

## トラブルシューティング

- `No staged changes found. Run \`git add\` first.`
  - `git add` で差分をステージしてから実行してください。
- `Error: GEMINI_API_KEY is not set`
  - 環境変数 `GEMINI_API_KEY` を設定してください。
