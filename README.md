# jwt-wails-app

このリポジトリのセットアップ手順をまとめています。主にローカルで開発・ビルドするためのコマンドを中心に記載します。

## 概要
Go + Wails を利用したデスクトップアプリケーション（JWT 関連機能を含む想定）です。フロントエンドは Node ベースのツールで管理されています。

## 前提条件
- Go (推奨: 1.25.0)
- Node.js (推奨: 24.6.0)
# jwt-wails-app

このリポジトリのローカル開発・ビルド手順をまとめています。ここでは macOS（zsh）を想定し、Go のバージョン管理に `goenv`、Node.js のバージョン管理に `nodenv` を使う前提で手順を記載します。

## 概要
Go + Wails を使ったデスクトップアプリケーション（JWT 関連の機能を含む想定）です。フロントエンドは `frontend/` 配下の Node ベースのツール（Next.js 等）で管理されています。

## 前提（この README の前提）
- macOS + zsh
- goenv（Go のバージョン管理）
- nodenv（Node.js のバージョン管理）
- package manager（npm / yarn / pnpm のいずれか）
- Wails CLI（v2）

必須ではありませんが、環境依存の差を減らすために上記のバージョン管理ツールを使うことを推奨します。

## 目次
- インストール: goenv / nodenv
- Go / Node のセットアップ
- Wails CLI のインストール
- プロジェクトのセットアップと実行
- よく使うコマンド
- トラブルシューティング

---

## 1) goenv と nodenv のインストール（macOS + Homebrew）
Homebrew が入っていることを前提とします。入っていない場合は https://brew.sh を参照してください。

```bash
# goenv と nodenv をインストール
brew update
brew install goenv nodenv

# nodenv のプラグイン（npm や node-build を使うため）
brew install node-build
```

zsh をお使いの場合、`~/.zshrc` に以下を追加して環境を有効化してください（既に追加されている場合は飛ばして構いません）。

```bash
# goenv
export GOENV_ROOT="$HOME/.goenv"
export PATH="$GOENV_ROOT/bin:$PATH"
eval "$(goenv init -)"

# nodenv
export NODENV_ROOT="$HOME/.nodenv"
export PATH="$NODENV_ROOT/bin:$PATH"
eval "$(nodenv init -)"
```

設定を反映させるため、ターミナルを再起動するか次を実行します:

```bash
source ~/.zshrc
```

## 2) Go と Node のインストール（プロジェクトで推奨されるバージョンを使う）
このリポジトリではローカルで使う Go と Node のバージョンを `.go-version` と `.node-version` に書いておくのを推奨します（なければ作成してください）。例:

```text
# .go-version
1.25.0

# .node-version
24.6.0
```

指定したバージョンをインストールして切り替えます:

```bash
# Go をインストールして有効化
goenv install 1.25.0
goenv global 1.25.0

# Node をインストールして有効化
nodenv install 24.6.0
nodenv global 24.6.0
nodenv rehash
```

インストールが成功していることを確認:

```bash
go version
node -v
npm -v
```

## 3) Wails CLI のインストール
Wails CLI は Go のツールとして提供されています（v2 推奨）。`goenv` で設定した Go 環境下でインストールしてください。

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# $GOPATH/bin または $HOME/go/bin を PATH に含める必要があります
export PATH="$PATH:$(go env GOPATH)/bin"
```

（`~/.zshrc` に PATH 追記しておくと恒久的です）

## 4) プロジェクトのセットアップ（ローカル）
1. リポジトリをクローンまたはプロジェクトルートに移動

```bash
git clone <repo-url>
cd jwt-wails-app
```

2. 環境変数を準備（必要に応じて）

```bash
# .env.example があればコピー
cp .env.example .env
# .env に JWT シークレットや DB の接続情報などを設定
```

3. Go モジュールを取得

```bash
go mod download
```

4. フロントエンド依存をインストール

フロントエンドは `frontend/` にあります。まずはそのディレクトリへ移動して依存をインストールします。

```bash
cd frontend
npm install -g pnpm@latest-10
pnpm install
cd -
```

（プロジェクトの package manager をローカルで固定したい場合は `package-lock.json` や `pnpm-lock.yaml` を参照してください）

## 5) 開発サーバ起動とビルド

- 開発モード（ホットリロード）:

```bash
wails dev
```

- リリースビルド:

```bash
wails build
```
