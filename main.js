/* GAME ON FLAG — Integración principal */
(function () {
  "use strict";

  window.GOF = window.GOF || {};

  const GOF = window.GOF;

  GOF.ui = GOF.ui || {};
  GOF.context = GOF.context || {
    activeLeague: null,
    activeTournament: null
  };

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
      setTimeout(
        () => loginEmail.focus(),
        50
      );
    }
  }

  function requireSession() {
    const session =
      getSession();

    if (!session) {
      showLoginView();

      throw new Error(
        "Necesitas iniciar sesión para continuar."
      );
    }

    return session;
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


  /* =====================================================
     DASHBOARD
  ===================================================== */

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
        const context =
          await GOF.dashboard.loadDashboard();

        if (
          context &&
          context.activeLeague
        ) {
          GOF.context =
            GOF.context || {};

          GOF.context.activeLeague =
            context.activeLeague;
        }
      } else {
        throw new Error(
          "El módulo Dashboard no está disponible."
        );
      }

      const league =
        getActiveLeague();

      setText(
        "#active-league-name",
        league?.name ||
          "Sin liga activa"
      );

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


  /* =====================================================
     LIGAS
  ===================================================== */

  async function loadLeagues() {
    requireSession();

    clearError();

    try {
      showLoading(
        "Cargando ligas..."
      );

      if (
        !GOF.leagues ||
        typeof GOF.leagues.listMyLeagues !==
          "function"
      ) {
        throw new Error(
          "El módulo de ligas no está disponible."
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

  function renderLeagueSelector(
    leagues
  ) {
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
                !GOF.leagues ||
                typeof GOF.leagues.setActiveLeague !==
                  "function"
              ) {
                throw new Error(
                  "La función para cambiar de liga no está disponible."
                );
              }

              await GOF.leagues.setActiveLeague(
                league.id
              );

              GOF.context =
                GOF.context || {};

              GOF.context.activeLeague =
                league;

              GOF.context.activeTournament =
                null;

              setText(
                "#active-league-name",
                league.name
              );

              setText(
                "#active-league-slug",
                league.slug
              );

              hideLoading();

              await loadTournaments();

              await refreshDashboard();

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


  /* =====================================================
     CREAR LIGA
  ===================================================== */

  async function createLeagueFromAction() {
    requireSession();

    if (
      !GOF.leagues ||
      typeof GOF.leagues.createLeague !==
        "function"
    ) {
      throw new Error(
        "La función para crear ligas no está disponible."
      );
    }

    const name =
      window.prompt(
        "Nombre de la liga:"
      );

    if (name === null) {
      return;
    }

    const cleanName =
      name.trim();

    if (!cleanName) {
      throw new Error(
        "El nombre de la liga es obligatorio."
      );
    }

    const slug =
      window.prompt(
        "Slug de la liga:",
        cleanName
          .toLowerCase()
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )
          .replace(
            /^-+|-+$/g,
            ""
          )
      );

    if (slug === null) {
      return;
    }

    const cleanSlug =
      slug.trim().toLowerCase();

    if (!cleanSlug) {
      throw new Error(
        "El slug de la liga es obligatorio."
      );
    }

    try {
      showLoading(
        "Creando liga..."
      );

      const result =
        await GOF.leagues.createLeague(
          cleanName,
          cleanSlug,
          null,
          {}
        );

      const createdLeague =
        Array.isArray(result)
          ? result[0]
          : result;

      if (
        createdLeague &&
        createdLeague.id
      ) {
        GOF.context =
          GOF.context || {};

        GOF.context.activeLeague =
          createdLeague;

        GOF.context.activeTournament =
          null;
      }

      hideLoading();

      await loadLeagues();

      await refreshDashboard();

      showView(
        "leagues"
      );

    } catch (error) {
      hideLoading();
      throw error;
    }
  }


  /* =====================================================
     TORNEOS
  ===================================================== */

  async function loadTournaments() {
    requireSession();

    const league =
      requireLeague();

    if (
      !GOF.tournaments ||
      typeof GOF.tournaments.listTournaments !==
        "function"
    ) {
      throw new Error(
        "El módulo de torneos no está disponible."
      );
    }

    showLoading(
      "Cargando torneos..."
    );

    try {
      const data =
        await GOF.tournaments.listTournaments();

      renderTournamentSelector(
        data
      );

      hideLoading();

      return data;

    } catch (error) {
      hideLoading();
      throw error;
    }
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

              const fullTournament =
                GOF.tournaments &&
                typeof GOF.tournaments.getTournament ===
                  "function"
                  ? await GOF.tournaments.getTournament(
                      tournament.id
                    )
                  : tournament;

              GOF.context =
                GOF.context || {};

              GOF.context.activeTournament =
                fullTournament ||
                tournament;

              setText(
                "#active-tournament-name",
                (
                  fullTournament ||
                  tournament
                ).name
              );

              setText(
                "#active-tournament-status",
                (
                  fullTournament ||
                  tournament
                ).status
              );

              await loadTournamentModules(
                fullTournament ||
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


  /* =====================================================
     CREAR TORNEO
  ===================================================== */

  async function createTournamentFromAction() {
    requireSession();
    requireLeague();

    if (
      !GOF.tournaments ||
      typeof GOF.tournaments.createTournament !==
        "function"
    ) {
      throw new Error(
        "La función para crear torneos no está disponible."
      );
    }

    const name =
      window.prompt(
        "Nombre del torneo:"
      );

    if (name === null) {
      return;
    }

    const cleanName =
      name.trim();

    if (!cleanName) {
      throw new Error(
        "El nombre del torneo es obligatorio."
      );
    }

    const season =
      window.prompt(
        "Temporada:",
        new Date()
          .getFullYear()
          .toString()
      );

    if (season === null) {
      return;
    }

    const startDate =
      window.prompt(
        "Fecha de inicio (AAAA-MM-DD):"
      );

    if (startDate === null) {
      return;
    }

    const endDate =
      window.prompt(
        "Fecha de término (AAAA-MM-DD):"
      );

    if (endDate === null) {
      return;
    }

    const rounds =
      window.prompt(
        "Número de jornadas regulares (3 o 7):",
        "7"
      );

    if (rounds === null) {
      return;
    }

    const regularRounds =
      Number(rounds);

    if (
      ![3, 7].includes(
        regularRounds
      )
    ) {
      throw new Error(
        "Las jornadas regulares deben ser 3 o 7."
      );
    }

    try {
      showLoading(
        "Creando torneo..."
      );

      const tournament =
        await GOF.tournaments.createTournament(
          {
            name: cleanName,
            season: season.trim() || null,
            start_date:
              startDate.trim() || null,
            end_date:
              endDate.trim() || null,
            status: "proximo",
            regular_rounds:
              regularRounds,
            tournament_type:
              "regular"
          }
        );

      GOF.context =
        GOF.context || {};

      GOF.context.activeTournament =
        tournament;

      setText(
        "#active-tournament-name",
        tournament.name
      );

      setText(
        "#active-tournament-status",
        tournament.status
      );

      await loadTournaments();

      hideLoading();

      showView(
        "tournament"
      );

    } catch (error) {
      hideLoading();
      throw error;
    }
  }


  /* =====================================================
     MÓDULOS DEL TORNEO
  ===================================================== */

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

    await Promise.all(
      tasks
    );
  }


  /* =====================================================
     NAVEGACIÓN DE MÓDULOS
  ===================================================== */

  async function loadViewData(
    view
  ) {
    const tournament =
      getActiveTournament();

    switch (view) {

      case "dashboard":
        await refreshDashboard();
        break;

      case "leagues":
        await loadLeagues();
        break;

      case "tournaments":
        await loadTournaments();
        break;

      case "categories":
        requireLeague();

        if (
          GOF.categories &&
          typeof GOF.categories.listCategories ===
            "function"
        ) {
          await GOF.categories.listCategories();
        }
        break;

      case "teams":
        requireLeague();

        if (
          GOF.teams &&
          typeof GOF.teams.listTeams ===
            "function"
        ) {
          await GOF.teams.listTeams();
        }
        break;

      case "roster":
        requireTournament();

        if (
          GOF.roster &&
          typeof GOF.roster.getTournamentTeamRoster ===
            "function"
        ) {
          /*
           * El roster requiere además
           * categoría y equipo.
           * No ejecutamos una consulta incompleta.
           */
        }
        break;

      case "credentials":
        requireTournament();
        break;

      case "matches":
        requireTournament();

        if (
          GOF.matches &&
          typeof GOF.matches.listMatches ===
            "function"
        ) {
          await GOF.matches.listMatches(
            tournament.id
          );
        }
        break;

      case "calendar":
        requireTournament();

        if (
          GOF.calendar &&
          typeof GOF.calendar.loadCalendar ===
            "function"
        ) {
          await GOF.calendar.loadCalendar(
            tournament.id
          );
        }
        break;

      case "schedule":
        requireTournament();
        break;

      case "results":
        requireTournament();

        if (
          GOF.results &&
          typeof GOF.results.listResults ===
            "function"
        ) {
          await GOF.results.listResults(
            tournament.id
          );
        }
        break;

      case "standings":
        requireTournament();

        if (
          GOF.standings &&
          typeof GOF.standings.getStandings ===
            "function"
        ) {
          await GOF.standings.getStandings(
            tournament.id
          );
        }
        break;

      case "playoffs":
        requireTournament();

        if (
          GOF.playoffs &&
          typeof GOF.playoffs.getPlayoffs ===
            "function"
        ) {
          await GOF.playoffs.getPlayoffs(
            tournament.id
          );
        }
        break;

      case "finance":
        requireLeague();

        if (
          GOF.finance &&
          typeof GOF.finance.getDashboard ===
            "function"
        ) {
          await GOF.finance.getDashboard();
        }
        break;

      case "notices":
        requireLeague();

        if (
          GOF.notices &&
          typeof GOF.notices.listNotices ===
            "function"
        ) {
          await GOF.notices.listNotices();
        }
        break;

      case "settings":
        requireLeague();

        if (
          GOF.settings &&
          typeof GOF.settings.getLeague ===
            "function"
        ) {
          await GOF.settings.getLeague();
        }
        break;

      case "publish":
        requireTournament();

        if (
          GOF.publish &&
          typeof GOF.publish.getPublicationSummary ===
            "function"
        ) {
          await GOF.publish.getPublicationSummary(
            tournament.id
          );
        }
        break;

      default:
        break;
    }
  }


  /* =====================================================
     CONTEXTO
  ===================================================== */

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

    setText(
      "#active-league-slug",
      league.slug
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


  /* =====================================================
     LOGIN
  ===================================================== */

  function bindLogin() {
    const form =
      $("#login-form");

    if (!form) {
      return;
    }

    if (
      form.dataset.bound ===
      "true"
    ) {
      return;
    }

    form.dataset.bound =
      "true";

    form.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        clearError(
          $("#login-error")
        );

        const email =
          $("#login-email")
            ?.value
            ?.trim();

        const password =
          $("#login-password")
            ?.value || "";

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

          const result =
            await GOF.auth.signIn(
              email,
              password
            );

          if (
            result &&
            result.session
          ) {
            GOF.session =
              result.session;

            GOF.user =
              result.user ||
              result.session.user;
          } else if (
            GOF.auth &&
            typeof GOF.auth.getSession ===
              "function"
          ) {
            GOF.session =
              await GOF.auth.getSession();
          }

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


  /* =====================================================
     NAVEGACIÓN
  ===================================================== */

  function bindNavigation() {
    $$("[data-gof-nav]").forEach(
      button => {

        if (
          button.dataset.bound ===
          "true"
        ) {
          return;
        }

        button.dataset.bound =
          "true";

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
              showLoading(
                "Cargando..."
              );

              await loadViewData(
                view
              );

              hideLoading();

              showView(
                view
              );

            } catch (error) {
              hideLoading();
              showError(error);
            }
          }
        );
      }
    );
  }


  /* =====================================================
     ACCIONES
  ===================================================== */

  function bindBasicActions() {

    const refresh =
      $("#btn-refresh");

    if (
      refresh &&
      refresh.dataset.bound !==
        "true"
    ) {
      refresh.dataset.bound =
        "true";

      refresh.addEventListener(
        "click",
        refreshDashboard
      );
    }

    const logout =
      $("#btn-logout");

    if (
      logout &&
      logout.dataset.bound !==
        "true"
    ) {
      logout.dataset.bound =
        "true";

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

            GOF.session = null;
            GOF.user = null;

            GOF.context =
              GOF.context || {};

            GOF.context.activeLeague =
              null;

            GOF.context.activeTournament =
              null;

            showLoginView();

          } catch (error) {
            showError(error);
          }
        }
      );
    }

    $$("[data-action]").forEach(
      button => {

        if (
          button.dataset.bound ===
          "true"
        ) {
          return;
        }

        button.dataset.bound =
          "true";

        button.addEventListener(
          "click",
          async () => {

            const action =
              button.dataset.action;

            try {

              clearError();

              switch (action) {

                case "create-league":
                  await createLeagueFromAction();
                  break;

                case "create-tournament":
                  await createTournamentFromAction();
                  break;

                default:
                  throw new Error(
                    `Acción no reconocida: ${action}`
                  );
              }

            } catch (error) {
              hideLoading();
              showError(error);
            }
          }
        );
      }
    );
  }


  /* =====================================================
     ARRANQUE
  ===================================================== */

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

      if (
        !auth ||
        !auth.session
      ) {
        showLoginView();
        return;
      }

      GOF.session =
        auth.session;

      GOF.user =
        auth.user ||
        auth.session.user;

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


  /* =====================================================
     API
  ===================================================== */

  GOF.ui.$ = $;
  GOF.ui.$$ = $$;

  GOF.ui.showView =
    showView;

  GOF.ui.showLoginView =
    showLoginView;

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

  GOF.ui.requireSession =
    requireSession;

  GOF.ui.requireLeague =
    requireLeague;

  GOF.ui.requireTournament =
    requireTournament;

  GOF.ui.boot =
    boot;


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
