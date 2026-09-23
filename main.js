/* GAME ON FLAG — Integración principal */
(function () {
  "use strict";

  window.GOF = window.GOF || {};

  const GOF = window.GOF;

  GOF.ui = GOF.ui || {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return Array.from(
      document.querySelectorAll(selector)
    );
  }

  function getActiveLeague() {
    return (
      GOF.context &&
      GOF.context.activeLeague
    ) || null;
  }

  function getActiveTournament() {
    return (
      GOF.context &&
      GOF.context.activeTournament
    ) || null;
  }

  function showLoading(
    message = "Cargando..."
  ) {
    const element =
      $("#app-loading");

    if (!element) return;

    element.textContent =
      message;

    element.hidden = false;
  }

  function hideLoading() {
    const element =
      $("#app-loading");

    if (!element) return;

    element.hidden = true;
  }

  function showError(
    error,
    container = null
  ) {
    const message =
      error?.message ||
      String(error) ||
      "Ocurrió un error.";

    const target =
      container ||
      $("#app-error");

    if (!target) {
      console.error(
        "GAME ON FLAG:",
        error
      );
      return;
    }

    target.textContent =
      message;

    target.hidden = false;
  }

  function clearError(
    container = null
  ) {
    const target =
      container ||
      $("#app-error");

    if (!target) return;

    target.textContent =
      "";

    target.hidden = true;
  }

  function setText(
    selector,
    value
  ) {
    const element =
      $(selector);

    if (!element) return;

    element.textContent =
      value ?? "";
  }

  function setHtml(
    selector,
    html
  ) {
    const element =
      $(selector);

    if (!element) return;

    element.innerHTML =
      html;
  }

  function showView(
    viewName
  ) {
    $$(
      "[data-gof-view]"
    ).forEach(
      view => {
        view.hidden =
          view.dataset.gofView !==
          viewName;
      }
    );

    $$(
      "[data-gof-nav]"
    ).forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset.gofNav ===
            viewName
        );
      }
    );

    GOF.ui.currentView =
      viewName;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function requireLeague() {
    const league =
      getActiveLeague();

    if (
      !league ||
      !league.id
    ) {
      throw new Error(
        "Primero selecciona una liga."
      );
    }

    return league;
  }

  function requireTournament() {
    const tournament =
      getActiveTournament();

    if (
      !tournament ||
      !tournament.id
    ) {
      throw new Error(
        "Primero selecciona un torneo."
      );
    }

    return tournament;
  }

  async function refreshDashboard() {
    clearError();

    try {
      showLoading(
        "Actualizando información..."
      );

      if (
        GOF.dashboard &&
        typeof GOF.dashboard.load ===
          "function"
      ) {
        await GOF.dashboard.load();
      }

      hideLoading();
    } catch (error) {
      hideLoading();
      showError(error);
    }
  }

  async function loadLeagues() {
    clearError();

    try {
      showLoading(
        "Cargando ligas..."
      );

      if (
        !GOF.leagues
      ) {
        throw new Error(
          "El módulo de ligas no está cargado."
        );
      }

      let leagues = [];

      if (
        typeof GOF.leagues.list ===
        "function"
      ) {
        leagues =
          await GOF.leagues.list();
      } else if (
        typeof GOF.leagues.getLeagues ===
        "function"
      ) {
        leagues =
          await GOF.leagues.getLeagues();
      }

      renderLeagueSelector(
        leagues
      );

      hideLoading();

      return leagues;
    } catch (error) {
      hideLoading();
      showError(error);
      throw error;
    }
  }

  function renderLeagueSelector(
    leagues
  ) {
    const container =
      $("#league-list");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    if (
      !leagues ||
      leagues.length === 0
    ) {
      container.innerHTML = `
        <div class="gof-empty-state">
          No tienes ligas disponibles.
        </div>
      `;

      return;
    }

    leagues.forEach(
      league => {
        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "gof-league-item";

        button.dataset.leagueId =
          league.id;

        button.innerHTML = `
          <strong>
            ${escapeHtml(
              league.name ||
                "Liga"
            )}
          </strong>

          ${
            league.slug
              ? `
                <small>
                  ${escapeHtml(
                    league.slug
                  )}
                </small>
              `
              : ""
          }
        `;

        button.addEventListener(
          "click",
          async () => {
            try {
              showLoading(
                "Cambiando de liga..."
              );

              if (
                GOF.settings &&
                typeof GOF.settings.setActiveLeague ===
                  "function"
              ) {
                await GOF.settings.setActiveLeague(
                  league.id
                );
              }

              if (
                GOF.context
              ) {
                GOF.context.activeLeague =
                  league;
              }

              hideLoading();

              await refreshCurrentContext();

              showView(
                "dashboard"
              );
            } catch (error) {
              hideLoading();
              showError(
                error
              );
            }
          }
        );

        container.appendChild(
          button
        );
      }
    );
  }

  async function loadTournaments() {
    const league =
      requireLeague();

    if (
      !GOF.tournaments
    ) {
      throw new Error(
        "El módulo de torneos no está cargado."
      );
    }

    let data = [];

    if (
      typeof GOF.tournaments.list ===
      "function"
    ) {
      data =
        await GOF.tournaments.list(
          league.id
        );
    } else if (
      typeof GOF.tournaments.getTournaments ===
      "function"
    ) {
      data =
        await GOF.tournaments.getTournaments(
          league.id
        );
    }

    renderTournamentSelector(
      data
    );

    return data;
  }

  function renderTournamentSelector(
    tournaments
  ) {
    const container =
      $("#tournament-list");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    if (
      !tournaments ||
      tournaments.length === 0
    ) {
      container.innerHTML = `
        <div class="gof-empty-state">
          No hay torneos registrados.
        </div>
      `;

      return;
    }

    tournaments.forEach(
      tournament => {
        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "gof-tournament-item";

        button.dataset.tournamentId =
          tournament.id;

        button.innerHTML = `
          <strong>
            ${escapeHtml(
              tournament.name ||
                "Torneo"
            )}
          </strong>

          ${
            tournament.status
              ? `
                <small>
                  ${escapeHtml(
                    tournament.status
                  )}
                </small>
              `
              : ""
          }
        `;

        button.addEventListener(
          "click",
          async () => {
            try {
              showLoading(
                "Abriendo torneo..."
              );

              GOF.context =
                GOF.context || {};

              GOF.context.activeTournament =
                tournament;

              await loadTournamentModules(
                tournament
              );

              hideLoading();

              showView(
                "tournament"
              );
            } catch (error) {
              hideLoading();
              showError(
                error
              );
            }
          }
        );

        container.appendChild(
          button
        );
      }
    );
  }

  async function loadTournamentModules(
    tournament
  ) {
    if (
      !tournament ||
      !tournament.id
    ) {
      throw new Error(
        "Torneo no válido."
      );
    }

    const tasks = [];

    if (
      GOF.categories &&
      typeof GOF.categories.list ===
        "function"
    ) {
      tasks.push(
        GOF.categories.list(
          tournament.id
        )
      );
    }

    if (
      GOF.teams &&
      typeof GOF.teams.list ===
        "function"
    ) {
      tasks.push(
        GOF.teams.list(
          tournament.id
        )
      );
    }

    await Promise.all(
      tasks
    );
  }

  async function refreshCurrentContext() {
    clearError();

    const league =
      getActiveLeague();

    if (!league) {
      await loadLeagues();
      return;
    }

    setText(
      "#active-league-name",
      league.name
    );

    try {
      await loadTournaments();
    } catch (error) {
      console.error(
        "No se pudieron cargar los torneos:",
        error
      );
    }

    await refreshDashboard();
  }

  function bindNavigation() {
    $$(
      "[data-gof-nav]"
    ).forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            const view =
              button.dataset.gofNav;

            if (!view) {
              return;
            }

            try {
              if (
                view ===
                "leagues"
              ) {
                await loadLeagues();
              }

              if (
                view ===
                "tournaments"
              ) {
                await loadTournaments();
              }

              showView(
                view
              );
            } catch (error) {
              showError(
                error
              );
            }
          }
        );
      }
    );
  }

  function bindBasicActions() {
    const refresh =
      $("#btn-refresh");

    if (refresh) {
      refresh.addEventListener(
        "click",
        refreshDashboard
      );
    }

    const logout =
      $("#btn-logout");

    if (logout) {
      logout.addEventListener(
        "click",
        async () => {
          try {
            if (
              GOF.auth &&
              typeof GOF.auth.logout ===
                "function"
            ) {
              await GOF.auth.logout();
            }

            window.location.reload();
          } catch (error) {
            showError(
              error
            );
          }
        }
      );
    }
  }

  async function boot() {
    try {
      showLoading(
        "Iniciando GAME ON FLAG..."
      );

      clearError();

      /*
       * app.js se encarga de inicializar Supabase.
       * Si todavía no terminó, esperamos.
       */
      if (
        GOF.ready &&
        typeof GOF.ready.then ===
          "function"
      ) {
        await GOF.ready;
      }

      if (
        GOF.auth &&
        typeof GOF.auth.init ===
          "function"
      ) {
        await GOF.auth.init();
      }

      bindNavigation();
      bindBasicActions();

      await refreshCurrentContext();

      hideLoading();

      /*
       * La pantalla inicial siempre es
       * GAME ON FLAG / Dashboard.
       */
      if (
        getActiveLeague()
      ) {
        showView(
          "dashboard"
        );
      } else {
        showView(
          "leagues"
        );
      }
    } catch (error) {
      hideLoading();
      showError(error);

      console.error(
        "GAME ON FLAG — Error de inicio:",
        error
      );
    }
  }

  function escapeHtml(
    value
  ) {
    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  GOF.ui.$ =
    $;

  GOF.ui.$$ =
    $$;

  GOF.ui.showView =
    showView;

  GOF.ui.showLoading =
    showLoading;

  GOF.ui.hideLoading =
    hideLoading;

  GOF.ui.showError =
    showError;

  GOF.ui.clearError =
    clearError;

  GOF.ui.refreshDashboard =
    refreshDashboard;

  GOF.ui.refreshCurrentContext =
    refreshCurrentContext;

  GOF.ui.requireLeague =
    requireLeague;

  GOF.ui.requireTournament =
    requireTournament;

  GOF.ui.boot =
    boot;

  /*
   * Arranque cuando el DOM esté listo.
   */
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      {
        once: true
      }
    );
  } else {
    boot();
  }
})();
