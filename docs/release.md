# リリース・バージョン管理手順

このドキュメントは `ai-git-tool` の開発者向けに、npmパッケージのバージョン管理とリリース手順をまとめたものです。

## 🚀 クイックスタート（推奨）

GitHub Actions により npm publish が自動化されています。リリースは以下のコマンド一発で完了します。

```bash
# パッチバージョンアップ（1.3.0 → 1.3.1）
npm run release:patch

# マイナーバージョンアップ（1.3.0 → 1.4.0）
npm run release:minor

# メジャーバージョンアップ（1.3.0 → 2.0.0）
npm run release:major
```

このコマンドは：
1. `package.json` のバージョンを自動更新
2. Git コミット & タグを自動作成
3. タグを GitHub に push
4. **GitHub Actions が自動的に npm publish を実行** ✨

## 前提条件

### 自動リリース（GitHub Actions）の場合

- リポジトリへの push 権限
- **npm トークンが GitHub Secrets に設定済み**（初回のみ）

### 手動リリースの場合

- [npmjs.com](https://www.npmjs.com/) にアカウントを作成済み
- `ai-git-tool` パッケージへの公開権限（メンテナー権限）を保有
- ローカルで npm にログイン済み

```bash
# ログイン状態を確認
npm whoami

# ログインしていない場合
npm login
```

### Git の設定

- リポジトリへの push 権限
- 適切な Git ユーザー名とメールアドレスの設定

```bash
git config user.name
git config user.email
```

### 作業ブランチ

- `main` ブランチから最新の状態を取得
- すべての変更がコミット済み
- テストが通ることを確認

```bash
git checkout main
git pull origin main
npm run build
```

## npm トークンの設定（初回のみ）

GitHub Actions で自動 publish するには、npm トークンを GitHub Secrets に設定する必要があります。

### 1. npm トークンを作成

1. https://www.npmjs.com/settings/[ユーザー名]/tokens にアクセス
2. 「Generate New Token」→「Classic Token」を選択
3. **Type: Automation** を選択（CI/CD用）
4. トークンをコピー（この画面を閉じると二度と表示されません）

### 2. GitHub Secrets に追加

1. https://github.com/ImaKento/ai-git-tool/settings/secrets/actions にアクセス
2. 「New repository secret」をクリック
3. 以下を入力：
   - **Name**: `NPM_TOKEN`
   - **Secret**: （上記でコピーしたトークン）
4. 「Add secret」をクリック

これで設定完了です。以降、タグを push すると自動的に npm publish が実行されます。

## セマンティックバージョニング（SemVer）

このプロジェクトは [Semantic Versioning 2.0.0](https://semver.org/lang/ja/) に従います。

バージョン番号は `MAJOR.MINOR.PATCH` の形式です。

- **MAJOR (メジャー)**: 後方互換性のない変更
  - 例: コマンドの引数仕様の変更、削除
  - `1.1.0` → `2.0.0`

- **MINOR (マイナー)**: 後方互換性のある機能追加
  - 例: 新しいコマンドやオプションの追加
  - `1.1.0` → `1.2.0`

- **PATCH (パッチ)**: 後方互換性のあるバグ修正
  - 例: バグ修正、誤字修正、依存関係の更新
  - `1.1.0` → `1.1.1`

## バージョンアップ手順

### 方法 1: npm version コマンド（推奨）

`npm version` コマンドを使うと、package.json の更新、Git コミット、Git タグの作成を自動で行えます。

```bash
# パッチバージョンアップ（1.1.0 → 1.1.1）
npm version patch

# マイナーバージョンアップ（1.1.0 → 1.2.0）
npm version minor

# メジャーバージョンアップ（1.1.0 → 2.0.0）
npm version major
```

このコマンドは以下を実行します：
1. `package.json` のバージョンを更新
2. 変更を Git コミット（メッセージ: `v1.2.0` など）
3. Git タグを作成（`v1.2.0`）

### 方法 2: 手動でバージョンを指定

```bash
npm version 1.3.0
```

### 方法 3: package.json を手動編集

`npm version` を使わない場合は、以下の手順で手動管理します。

1. `package.json` の `version` フィールドを編集
2. 変更をコミット
3. Git タグを作成

```bash
# 編集後
git add package.json
git commit -m "chore: bump version to 1.2.0"
git tag v1.2.0
```

## リリース手順

### 方法 1: 自動リリース（推奨）

GitHub Actions により、タグを push すると自動的に npm publish が実行されます。

```bash
# パッチバージョン（バグ修正）
npm run release:patch

# マイナーバージョン（機能追加）
npm run release:minor

# メジャーバージョン（破壊的変更）
npm run release:major
```

実行されること：
1. `package.json` のバージョン更新
2. Git コミット作成（メッセージ: `v1.3.1`）
3. Git タグ作成（`v1.3.1`）
4. タグを GitHub に push
5. **GitHub Actions が自動起動**
   - 依存関係のインストール
   - TypeScript ビルド
   - npm publish 実行

### 方法 2: 手動リリース

自動化を使わず、手動で公開する場合：

#### 1. バージョンアップ

```bash
npm version patch  # または minor / major
```

#### 2. Git タグを push

```bash
git push origin main --tags
```

#### 3. ビルド確認

```bash
npm run build
```

#### 4. npm に公開

```bash
npm publish
```

### リリース確認

npm レジストリで公開されたことを確認します。

```bash
# 最新バージョンを確認
npm view ai-git-tool version

# パッケージ情報を表示
npm view ai-git-tool

# ブラウザで確認
open https://www.npmjs.com/package/ai-git-tool
```

GitHub Actions のログも確認：
- https://github.com/ImaKento/ai-git-tool/actions

### インストールテスト

別のディレクトリで実際にインストールして動作確認します。

```bash
cd /tmp
npm install -g ai-git-tool@latest
ai-git --help
```

## GitHub Release の作成（推奨）

npm publish と合わせて、GitHub Release でリリースノートを公開することを推奨します。

### リリースノートの書き方

リリースノートには以下を含めると良いです：

```markdown
## ✨ What's New

### 新機能
- コンフリクト自動検知機能を追加
- PR作成前に自動的にmainブランチとマージ

### 改善
- エラーメッセージをより分かりやすく改善
- パフォーマンスの最適化

### バグ修正
- 日本語ブランチ名での不具合を修正
- タイムアウトエラーの修正

### その他
- 依存関係の更新
- ドキュメントの改善

## 📦 Installation

\`\`\`bash
npm install -g ai-git-tool@1.3.1
\`\`\`

## 🔗 Links

- [npm package](https://www.npmjs.com/package/ai-git-tool)
- [Changelog](https://github.com/ImaKento/ai-git-tool/blob/main/CHANGELOG.md)
```

### 方法 1: GitHub CLI を使用（推奨）

```bash
# リリースノートをファイルから読み込む
gh release create v1.3.1 --title "v1.3.1" --notes-file release-notes.md

# または直接記述
gh release create v1.3.1 --title "v1.3.1" --notes "
## ✨ What's New

### 新機能
- コンフリクト自動検知機能を追加
- PR作成前に自動的にmainブランチとマージ

## 📦 Installation

\`\`\`bash
npm install -g ai-git-tool@1.3.1
\`\`\`
"
```

### 方法 2: GitHub Web UI

1. https://github.com/ImaKento/ai-git-tool/releases にアクセス
2. "Draft a new release" をクリック
3. "Choose a tag" で既存のタグを選択（例: `v1.3.1`）
4. "Release title" に `v1.3.1` と入力
5. リリースノートを記入（上記のテンプレートを参考に）
6. "Publish release" をクリック

### 方法 3: 自動生成（実験的）

GitHub の自動生成機能を使う：

1. "Generate release notes" ボタンをクリック
2. コミット履歴から自動的にリリースノートが生成される
3. 必要に応じて編集して公開

## リリースノートのヒント

### 良い例

```markdown
## v1.3.1

### 新機能
- PR作成時にコンフリクトを自動検知 (#25)
  - コンフリクトがない場合は自動的にmainをマージ
  - コンフリクトがある場合は選択肢を提示（merge/rebase/skip/abort）

### バグ修正
- ブランチ名にスラッシュが含まれる場合の不具合を修正 (#23)

**Full Changelog**: https://github.com/ImaKento/ai-git-tool/compare/v1.3.0...v1.3.1
```

### 悪い例

```markdown
## v1.3.1

- いろいろ修正
- バグ直した
```

ユーザーにとって何が変わったのか、どんな価値があるのかを明確に伝えましょう。

## トラブルシューティング

### GitHub Actions で publish が失敗する

#### 1. npm トークンが設定されていない

GitHub Actions のログに以下のエラーが表示される：

```
npm ERR! need auth This command requires you to be logged in.
```

**対処法:**

1. npm トークンを作成（上記「npm トークンの設定」を参照）
2. GitHub Secrets に `NPM_TOKEN` を追加

#### 2. npm トークンの権限が不足

```
npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/ai-git-tool
```

**対処法:**

- npm トークンのタイプが **Automation** になっているか確認
- パッケージへの公開権限があるか確認

#### 3. ビルドエラー

GitHub Actions でビルドが失敗する場合：

**対処法:**

```bash
# ローカルでビルドエラーを確認
npm run build

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 4. GitHub Actions のログを確認

詳細なエラー内容は以下で確認できます：
- https://github.com/ImaKento/ai-git-tool/actions

各ステップのログを展開してエラー内容を確認してください。

### `npm publish` でエラーが出る（手動リリース時）

#### 1. ログインしていない

```
npm ERR! need auth This command requires you to be logged in.
```

**対処法:**

```bash
npm login
```

#### 2. 権限がない

```
npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/ai-git-tool
npm ERR! 403 You do not have permission to publish "ai-git-tool".
```

**対処法:**
- パッケージのメンテナーに権限を付与してもらう
- または、パッケージ所有者に公開を依頼する

#### 3. バージョンが既に存在

```
npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/ai-git-tool
npm ERR! 403 You cannot publish over the previously published versions: 1.2.0.
```

**対処法:**
- バージョン番号を上げてから再度公開
- npm では一度公開したバージョンは上書きできません

```bash
npm version patch
npm publish
```

#### 4. ビルドエラー

`prepublishOnly` スクリプトでビルドが失敗する場合。

**対処法:**

```bash
# TypeScript のエラーを確認
npm run build

# node_modules を再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Git タグの削除・再作成

間違ったタグを作成してしまった場合。

```bash
# ローカルのタグを削除
git tag -d v1.2.0

# リモートのタグを削除
git push origin :refs/tags/v1.2.0

# 正しいタグを再作成
git tag v1.2.0
git push origin v1.2.0
```

### npm 公開の取り消し（72時間以内のみ）

公開から 72 時間以内であれば、`npm unpublish` で削除できます。

```bash
npm unpublish ai-git-tool@1.2.0
```

ただし、**本番環境では非推奨**です。代わりに新しいバージョンをリリースして修正してください。

## チェックリスト

### リリース前

- [ ] すべてのテストが通る
- [ ] `npm run build` が成功する
- [ ] `main` ブランチが最新（`git pull origin main`）
- [ ] バージョン番号が適切（SemVer に従う）
- [ ] README.md が最新の機能を反映している
- [ ] CHANGELOG.md を更新済み（もしあれば）
- [ ] **npm トークンが GitHub Secrets に設定済み**（初回のみ）

### リリース実行

自動リリースの場合：

```bash
npm run release:patch  # または minor / major
```

### リリース後

- [ ] GitHub Actions のワークフローが成功したか確認
  - https://github.com/ImaKento/ai-git-tool/actions
- [ ] `npm view ai-git-tool version` で公開を確認
- [ ] **GitHub Release を作成してリリースノートを公開**
- [ ] インストールテストを実施
  ```bash
  npm install -g ai-git-tool@latest
  ai-git --help
  ```
- [ ] チームメンバーや利用者に通知（Twitter、Discord など）

## 参考リンク

### npm
- [npm-version documentation](https://docs.npmjs.com/cli/v10/commands/npm-version)
- [npm-publish documentation](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [npm Tokens](https://docs.npmjs.com/about-access-tokens)
- [Semantic Versioning](https://semver.org/lang/ja/)
- [npm Registry](https://www.npmjs.com/)

### GitHub
- [GitHub Actions - Publishing Node.js packages](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [GitHub CLI - release create](https://cli.github.com/manual/gh_release_create)
- [Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

### このプロジェクト
- [GitHub Releases](https://github.com/ImaKento/ai-git-tool/releases)
- [GitHub Actions Workflows](https://github.com/ImaKento/ai-git-tool/actions)
- [npm Package](https://www.npmjs.com/package/ai-git-tool)
