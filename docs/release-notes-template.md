# Release Notes Template

このテンプレートを使って GitHub Release のリリースノートを作成してください。

## v[VERSION]

### ✨ 新機能

- 機能の説明 (#PR番号)
  - 詳細な説明や使い方
  - 補足情報

### 🔧 改善

- 改善内容の説明 (#PR番号)
- パフォーマンスの向上 (#PR番号)

### 🐛 バグ修正

- 修正内容の説明 (#PR番号)
- エッジケースの対応 (#PR番号)

### 📚 ドキュメント

- ドキュメントの追加・更新内容

### 🔨 内部改善

- リファクタリング
- 依存関係の更新
- テストの追加・改善

### ⚠️ 破壊的変更（メジャーバージョンの場合のみ）

- 変更内容と影響範囲
- マイグレーション方法

## 📦 Installation

\`\`\`bash
npm install -g ai-git-tool@[VERSION]
\`\`\`

## 🔗 Links

- [npm package](https://www.npmjs.com/package/ai-git-tool/v/[VERSION])
- [Full Changelog](https://github.com/ImaKento/ai-git-tool/compare/v[PREV_VERSION]...v[VERSION])

---

## 使用例

### v1.3.1

### ✨ 新機能

- PR作成時にコンフリクトを自動検知 (#25)
  - コンフリクトがない場合は自動的に `origin/main` をマージ
  - コンフリクトがある場合は選択肢を提示（merge/rebase/skip/abort）
  - 事前にコンフリクトを解消できるため、PR作成後の手戻りがなくなります

### 🔧 改善

- エラーメッセージを日本語・英語両対応に改善
- `ai-git pr` コマンドのパフォーマンスを最適化

### 🐛 バグ修正

- ブランチ名にスラッシュが含まれる場合の不具合を修正 (#23)
- Git fetch 時のタイムアウトエラーを修正

### 📚 ドキュメント

- リリース手順書を更新（GitHub Actions 自動 publish に対応）
- README に新機能の使い方を追加

## 📦 Installation

\`\`\`bash
npm install -g ai-git-tool@1.3.1
\`\`\`

## 🔗 Links

- [npm package](https://www.npmjs.com/package/ai-git-tool/v/1.3.1)
- [Full Changelog](https://github.com/ImaKento/ai-git-tool/compare/v1.3.0...v1.3.1)
