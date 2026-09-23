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

  function getSession() {
    return GOF.session || null;
  }

  function showLoading(message = "Cargando...") {
    const element = $("#app-loading");

    if (!element) return;

    element.textContent = message;
    element.hidden = false;
  }

  function hideLoading() {
    const element = $("#app-loading");

    if (!element) return;

    element.hidden = true;
  }

  function showError(error, container = null) {
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

    target.textContent = message;
    target.hidden = false;
  }

  function clearError(container = null) {
    const target =
      container ||
      $("#app-error");

    if (!target) return;

    target.textContent = "";
    target.hidden = true;
  }

  function setText(selector, value) {
    const element = $(selector);

    if (!element) return;

    element.textContent = value ?? "";
  }

  function showView(viewName) {
    $$("[data-gof-view]").forEach(
      view => {
        view.hidden =
          view.dataset.gofView !==
          viewName;
      }
    );

    $$("[data-gof-nav]").forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset.gofNav ===
            viewName
        );
      }
    );

    GOF.ui.currentView = viewName;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function showLoginView() {
    showView("login");

    const loginEmail =
      $("#login-email");

    if (loginEmail) {
      loginEmail.focus();
    }
  }

  function requireSession() {
    const session = getSession();

    if (!session) {
      showLoginView();

      throw new Error(
        "Necesitas iniciar sesión para continuar."
      );
    }

    return session;
  }

  function requireLeague() {
    const league = getActiveLeague();

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

  /*
   * DASHBOARD
   */
  async function refreshDashboard() {
    clearError();

    try {
      requireSession();

      showLoading(
        "Actualizando información..."
      );

      if (
        GOF.dashboard &&
        typeof GOF.dashboard.loadDashboard ===
          "function"
      ) {
        await GOF.dashboard.loadDashboard();
      } else {
        throw new Error(
          "El módulo Dashboard no está disponible."
        );
      }

      hideLoading();

    } catch (error) {
      hideLoading();

      if (!getSession()) {
        showLoginView();
        return;
      }

      showError(error);
    }
  }

  /*
   * LIGAS
   */
  async function loadLeagues() {
    requireSession();

    clearError();

    try {
      showLoading(
        "Cargando ligas..."
      );

      if (!GOF.leagues) {
        throw new Error(
          "El módulo de ligas no está cargado."
        );
      }

      if (
        typeof GOF.leagues.listMyLeagues !==
        "function"
      ) {
        throw new Error(
          "La función de ligas no está disponible."
        );
      }

      const leagues =
        await GOF.leagues.listMyLeagues();

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

  function renderLeagueSelector(leagues) {
    const container =
      $("#league-list");

    if (!container) {
      return;
    }

    container.innerHTML = "";

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

        button.type = "button";

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
              requireSession();

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
              } else {
                throw new Error(
                  "La función para cambiar de liga no está disponible."
                );
              }

              GOF.context =
                GOF.context || {};

              GOF.context.activeLeague =
                league;

              GOF.context.activeTournament =
                null;

              hideLoading();

              await refreshCurrentContext();

              showView(
                "dashboard"
              );

            } catch (error) {
              hideLoading();
              showError(error);
            }
          }
        );

        container.appendChild(
          button
        );
      }
    );
  }

  /*
   * TORNEOS
   */
  async function loadTournaments() {
    requireSession();

    const league =
      requireLeague();

    if (!GOF.tournaments) {
      throw new Error(
        "El módulo de torneos no está cargado."
      );
    }

    if (
      typeof GOF.tournaments.listTournaments !==
      "function"
    ) {
      throw new Error(
        "La función de torneos no está disponible."
      );
    }

    const data =
      await GOF.tournaments.listTournaments();

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

    container.innerHTML = "";

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

        button.type = "button";

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
              requireSession();

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
              showError(error);
            }
          }
        );

        container.appendChild(
          button
        );
      }
    );
  }

  /*
   * MÓDULOS DEL TORNEO
   */
  async function loadTournamentModules(
    tournament
  ) {
    requireSession();

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
      typeof GOF.categories.listCategories ===
        "function"
    ) {
      tasks.push(
        GOF.categories.listCategories()
      );
    }

    if (
      GOF.teams &&
      typeof GOF.teams.listTeams ===
        "function"
    ) {
      tasks.push(
        GOF.teams.listTeams()
      );
    }

    await Promise.all(tasks);
  }

  /*
   * CONTEXTO
   */
  async function refreshCurrentContext() {
    clearError();

    if (!getSession()) {
      showLoginView();
      return;
    }

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

  /*
   * LOGIN
   */
  function bindLogin() {
    const form =
      $("#login-form");

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        clearError();

        const email =
          $("#login-email")?.value
            ?.trim();

        const password =
          $("#login-password")?.value || "";

        if (!email) {
          showError(
            new Error(
              "Escribe tu correo electrónico."
            ),
            $("#login-error")
          );
          return;
        }

        if (!password) {
          showError(
            new Error(
              "Escribe tu contraseña."
            ),
            $("#login-error")
          );
          return;
        }

        try {
          showLoading(
            "Iniciando sesión..."
          );

          if (
            !GOF.auth ||
            typeof GOF.auth.signIn !==
              "function"
          ) {
            throw new Error(
              "El módulo de autenticación no está disponible."
            );
          }

          await GOF.auth.signIn(
            email,
            password
          );

          await GOF.auth.init();

          hideLoading();

          form.reset();

          await refreshCurrentContext();

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

          showError(
            error,
            $("#login-error")
          );
        }
      }
    );
  }

  /*
   * NAVEGACIÓN
   */
  function bindNavigation() {
    $$("[data-gof-nav]").forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            const view =
              button.dataset.gofNav;

            if (!view) {
              return;
            }

            if (!getSession()) {
              showLoginView();
              return;
            }

            try {
              if (
                view === "leagues"
              ) {
                await loadLeagues();
              }

              if (
                view === "tournaments"
              ) {
                await loadTournaments();
              }

              showView(view);

            } catch (error) {
              showError(error);
            }
          }
        );
      }
    );
  }

  /*
   * ACCIONES
   */
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
            } else {
              throw new Error(
                "La función de cierre de sesión no está disponible."
              );
            }

            showLoginView();

          } catch (error) {
            showError(error);
          }
        }
      );
    }
  }

  /*
   * ARRANQUE
   */
  async function boot() {
    try {
      showLoading(
        "Iniciando GAME ON FLAG..."
      );

      clearError();

      if (
        !GOF.auth ||
        typeof GOF.auth.init !==
          "function"
      ) {
        throw new Error(
          "El módulo de autenticación no está disponible."
        );
      }

      const auth =
        await GOF.auth.init();

      bindLogin();
      bindNavigation();
      bindBasicActions();

      hideLoading();

      if (!auth.session) {
        showLoginView();
        return;
      }

      await refreshCurrentContext();

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

  function escapeHtml(value) {
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

  /*
   * API
   */
  GOF.ui.$ = $;
  GOF.ui.$$ = $$;
  GOF.ui.showView = showView;
  GOF.ui.showLoginView = showLoginView;
  GOF.ui.showLoading = showLoading;
  GOF.ui.hideLoading = hideLoading;
  GOF.ui.showError = showError;
  GOF.ui.clearError = clearError;
  GOF.ui.refreshDashboard =
    refreshDashboard;
  GOF.ui.refreshCurrentContext =
    refreshCurrentContext;
  GOF.ui.requireSession =
    requireSession;
  GOF.ui.requireLeague =
    requireLeague;
  GOF.ui.requireTournament =
    requireTournament;
  GOF.ui.boot = boot;

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
