package app

import (
	"context"
)

type App struct{}

func NewApp() *App { return &App{} }

func (a *App) Startup(_ context.Context) {}
