package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	// "github.com/wailsapp/wails/v2/pkg/options/mac"

	appPkg "github.com/withforesight000/jwt-wails-app/internal/app"
)

// Next.js の export 出力をバンドル
//
//go:embed all:frontend/out
var assets embed.FS

func main() {
	app := appPkg.NewApp()

	if err := wails.Run(&options.App{
		Title:  "JWT Inspector",
		Width:  1024,
		Height: 1024,
		// 0–255 の RGBA。A は 255 (不透明) を推奨
		BackgroundColour: &options.RGBA{R: 24, G: 24, B: 27, A: 255},
		// v2 では AssetServer は assetserver.Options を使う
		AssetServer: &assetserver.Options{Assets: assets},
		// Mac のタイトルバー設定は *mac.TitleBar を指定
		// Mac:  &mac.Options{TitleBar: mac.TitleBarHiddenInset()},
		Bind: []interface{}{app},
	}); err != nil {
		log.Fatal(err)
	}
}
