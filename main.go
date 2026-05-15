package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/joaov/putch/internal/config"
	"github.com/joaov/putch/internal/git"
	"github.com/joaov/putch/internal/github"
	"github.com/joaov/putch/internal/services"
	"github.com/joaov/putch/internal/store"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	st, err := store.Open()
	if err != nil {
		log.Fatalf("falha ao abrir workspace: %v", err)
	}

	// Camada de colaboração: config compartilhado da suíte Adila → github
	// (auth + API) + git (motor local) → SyncService (fachada para a UI).
	cfg := config.New()
	gh := github.NewService(cfg)
	gitSvc := git.NewService()
	sync := services.NewSyncService(st, gitSvc, gh)

	app := application.New(application.Options{
		Name:        "putch",
		Description: "API client desktop",
		Services: []application.Service{
			application.NewService(services.NewCollectionsService(st)),
			application.NewService(services.NewFoldersService(st)),
			application.NewService(services.NewRequestsService(st)),
			application.NewService(services.NewEnvironmentsService(st)),
			application.NewService(sync),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Liga o hook de eventos do github à ponte Wails (Emit retorna bool;
	// o hook é func(string, ...any)). Assim "github.changed" e
	// "github:clone-progress" chegam ao frontend sem o pacote github
	// conhecer o Wails.
	gh.Emit = func(name string, data ...any) {
		app.Event.Emit(name, data...)
	}

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "putch",
		Width:            800,
		Height:           600,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
