# ai-commit

Gemini API を使って、ステージ済み差分からコミットメッセージを自動生成する TypeScript 製 CLI です。

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

`npm link` 後は、どの Git リポジトリでも `ai-commit` が使えます。

## 環境変数

```bash
export GEMINI_API_KEY="your_api_key"
```

API キーの取得先: [Google AI Studio](https://aistudio.google.com/apikey)

## 使い方

1. 先に変更をステージ

```bash
git add .
```

2. コミットメッセージを生成

```bash
# 通常（タイトル + 箇条書き本文）
ai-commit

# 短文（1行の Conventional Commits）
ai-commit --short
```

3. 確認プロンプトで選択

- `y`: そのままコミット
- `n`: 中止
- `e`: エディタで編集してからコミット

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
