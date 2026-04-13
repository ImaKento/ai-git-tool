# リリース・バージョン管理手順

このドキュメントは `ai-git-tool` の開発者向けに、npmパッケージのバージョン管理とリリース手順をまとめたものです。

## 前提条件

リリースを実行するには、以下が必要です。

### 1. npm アカウントと権限

- [npmjs.com](https://www.npmjs.com/) にアカウントを作成済み
- `ai-git-tool` パッケージへの公開権限（メンテナー権限）を保有
- ローカルで npm にログイン済み

```bash
# ログイン状態を確認
npm whoami

# ログインしていない場合
npm login
```

### 2. Git の設定

- リポジトリへの push 権限
- 適切な Git ユーザー名とメールアドレスの設定

```bash
git config user.name
git config user.email
```

### 3. 作業ブランチ

- `main` ブランチから最新の状態を取得
- すべての変更がコミット済み
- テストが通ることを確認

```bash
git checkout main
git pull origin main
npm run build
```

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

### 1. バージョンアップ

上記の「バージョンアップ手順」に従ってバージョンを更新します。

```bash
npm version patch  # または minor / major
```

### 2. Git タグを push

```bash
git push origin main --tags
```

タグだけを push する場合:

```bash
git push origin v1.2.0
```

### 3. ビルド確認

`prepublishOnly` スクリプトにより、`npm publish` 時に自動でビルドが実行されますが、事前に確認することを推奨します。

```bash
npm run build
```

### 4. npm に公開

```bash
npm publish
```

公開が成功すると、以下のようなメッセージが表示されます。

```
+ ai-git-tool@1.2.0
```

### 5. 公開確認

npm レジストリで公開されたことを確認します。

```bash
# パッケージ情報を表示
npm view ai-git-tool

# 最新バージョンを確認
npm view ai-git-tool version

# ブラウザで確認
open https://www.npmjs.com/package/ai-git-tool
```

### 6. インストールテスト

別のディレクトリで実際にインストールして動作確認します。

```bash
cd /tmp
npm install -g ai-git-tool@latest
ai-git --help
```

## GitHub Release の作成（任意）

GitHub の Release 機能を使ってリリースノートを公開することもできます。

### 方法 1: GitHub CLI を使用

```bash
gh release create v1.2.0 --title "v1.2.0" --notes "
## Changes
- 新機能の追加
- バグ修正

## Install
\`\`\`bash
npm install -g ai-git-tool@1.2.0
\`\`\`
"
```

### 方法 2: GitHub Web UI

1. リポジトリの [Releases](https://github.com/ImaKento/ai-git-tool/releases) ページを開く
2. "Draft a new release" をクリック
3. タグを選択（例: `v1.2.0`）
4. リリースノートを記入
5. "Publish release" をクリック

## トラブルシューティング

### `npm publish` でエラーが出る

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

リリース前に以下を確認してください。

- [ ] すべてのテストが通る
- [ ] `npm run build` が成功する
- [ ] `main` ブランチが最新
- [ ] バージョン番号が適切（SemVer に従う）
- [ ] `npm whoami` でログイン確認済み
- [ ] CHANGELOG.md を更新済み（もしあれば）
- [ ] README.md が最新の機能を反映している

リリース後:

- [ ] `npm view ai-git-tool version` で公開を確認
- [ ] GitHub Release を作成（任意）
- [ ] インストールテストを実施
- [ ] チームメンバーに通知

## 参考リンク

- [npm-version documentation](https://docs.npmjs.com/cli/v10/commands/npm-version)
- [npm-publish documentation](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [Semantic Versioning](https://semver.org/lang/ja/)
- [npm Registry](https://www.npmjs.com/)
