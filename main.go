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
	// Config compartilhado da suíte Adila primeiro: dele sai a pasta de
	// workspace escolhida pelo usuário (se houver) antes de abrir o store.
	cfg := config.New()

	st, err := openWorkspace(cfg)
	if err != nil {
		log.Fatalf("falha ao abrir workspace: %v", err)
	}

	// Aplica o workspace ativo salvo no config (se ainda válido); senão
	// permanece no que o store escolheu (mais recente / "Padrão").
	if id, ok := cfg.Get(services.ConfigKeyActiveWorkspace, "").(string); ok && id != "" {
		_ = st.SetWorkspace(id)
	}

	// Camada de colaboração: config → github (auth + API) + git (motor
	// local) → SyncService (fachada para a UI).
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
			application.NewService(services.NewTestsService(st)),
			application.NewService(services.NewWorkspaceService(st, cfg)),
			application.NewService(services.NewWorkspacesService(st, cfg)),
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
		Frameless:        true,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

// openWorkspace abre o store na pasta salva no config (se houver) ou no
// padrão. Se a pasta salva falhar ao abrir (sumiu, sem permissão), cai no
// padrão em vez de travar o app por uma preferência inválida.
func openWorkspace(cfg *config.Config) (*store.Store, error) {
	if p, ok := cfg.Get(services.ConfigKeyWorkspace, "").(string); ok && p != "" {
		if st, err := store.OpenAt(p); err == nil {
			return st, nil
		}
	}
	return store.Open()
}
