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


  /* =====================================================
     UTILIDADES
  ===================================================== */

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return Array.from(
      document.querySelectorAll(selector)
    );
  }

  function getSession() {
    return GOF.session || null;
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(selector, value) {
    const element = $(selector);

    if (!element) {
      return;
    }

    element.textContent =
      value ?? "";
  }


  /* =====================================================
     LOADING / ERRORES
  ===================================================== */

  function showLoading(
    message = "Cargando..."
  ) {
    const element =
      $("#app-loading");

    if (!element) {
      return;
    }

    element.textContent =
      message;

    element.hidden = false;
  }

  function hideLoading() {
    const element =
      $("#app-loading");

    if (!element) {
      return;
    }

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

    console.error(
      "GAME ON FLAG:",
      error
    );
  }

  function clearError(
    container = null
  ) {
    const target =
      container ||
      $("#app-error");

    if (!target) {
      return;
    }

    target.textContent = "";
    target.hidden = true;
  }


  /* =====================================================
     VISTAS
  ===================================================== */

  function showView(
    viewName
  ) {
    $$(
      "[data-gof-view]"
    ).forEach(view => {
      view.hidden =
        view.dataset.gofView !==
        viewName;
    });

    $$(
      "[data-gof-nav]"
    ).forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.gofNav ===
          viewName
      );
    });

    /*
     * El login y la aplicación son
     * contenedores independientes.
     *
     * Cuando se muestra login,
     * ocultamos completamente
     * app-shell.
     */
    const appShell =
      $("#app-shell");

    if (appShell) {
      appShell.hidden =
        viewName === "login";
    }

    GOF.ui.currentView =
      viewName;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function showLoginView() {
    showView("login");

    const email =
      $("#login-email");

    if (email) {
      setTimeout(
        () => email.focus(),
        50
      );
    }
  }


  /* =====================================================
     VALIDACIONES DE CONTEXTO
  ===================================================== */

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
    requireSession();

    clearError();

    try {
      showLoading(
        "Actualizando información..."
      );

      const previousTournament =
        getActiveTournament();

      if (
        !GOF.dashboard ||
        typeof GOF.dashboard.loadDashboard !==
          "function"
      ) {
        throw new Error(
          "El módulo Dashboard no está disponible."
        );
      }

      const result =
        await GOF.dashboard.loadDashboard();

      /*
       * dashboard.js puede reconstruir
       * el contexto. Conservamos el torneo
       * activo cuando corresponde.
       */
      GOF.context =
        GOF.context || {};

      if (
        previousTournament &&
        previousTournament.id
      ) {
        GOF.context.activeTournament =
          previousTournament;
      }

      if (
        result &&
        result.activeLeague
      ) {
        GOF.context.activeLeague =
          result.activeLeague;
      }

      const league =
        getActiveLeague();

      setText(
        "#active-league-name",
        league?.name ||
          "Selecciona una liga"
      );

      hideLoading();

    } catch (error) {
      hideLoading();

      if (!getSession()) {
        showLoginView();
        return;
      }

      showError(error);
      throw error;
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
      !Array.isArray(leagues) ||
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

              await loadTournaments();

              hideLoading();

              showView(
                "dashboard"
              );

              await refreshDashboard();

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

    const suggestedSlug =
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
        );

    const slug =
      window.prompt(
        "Slug de la liga:",
        suggestedSlug
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

      const created =
        Array.isArray(result)
          ? result[0]
          : result;

      GOF.context =
        GOF.context || {};

      if (
        created &&
        created.id
      ) {
        GOF.context.activeLeague =
          created;

        GOF.context.activeTournament =
          null;
      }

      await loadLeagues();

      hideLoading();

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

    try {
      showLoading(
        "Cargando torneos..."
      );

      const tournaments =
        await GOF.tournaments.listTournaments();

      renderTournamentSelector(
        tournaments
      );

      hideLoading();

      return tournaments;

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
      !Array.isArray(tournaments) ||
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

              let selected =
                tournament;

              if (
                GOF.tournaments &&
                typeof GOF.tournaments.getTournament ===
                  "function"
              ) {
                const result =
                  await GOF.tournaments.getTournament(
                    tournament.id
                  );

                if (result) {
                  selected =
                    result;
                }
              }

              GOF.context =
                GOF.context || {};

              GOF.context.activeTournament =
                selected;

              setText(
                "#active-tournament-name",
                selected.name
              );

              setText(
                "#active-tournament-status",
                selected.status
              );

              await loadTournamentModules(
                selected
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

    const rounds =
      window.prompt(
        "Jornadas regulares (3 o 7):",
        "7"
      );

    if (rounds === null) {
      return;
    }

    const regularRounds =
      Number(rounds);

    if (
      regularRounds !== 3 &&
      regularRounds !== 7
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
            name:
              cleanName,
            status:
              "proximo",
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
        tournament?.name ||
          cleanName
      );

      setText(
        "#active-tournament-status",
        tournament?.status ||
          "proximo"
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
     CARGA INICIAL DEL TORNEO
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
     CARGA DE VISTAS
  ===================================================== */

  async function loadViewData(
    view
  ) {
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
        break;


      case "credentials":
        requireTournament();
        break;


      case "sportwey":
        requireLeague();
        break;


      case "matches":
        {
          const tournament =
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
        }

        break;


      case "calendar":
        {
          const tournament =
            requireTournament();

          /*
           * calendar.js utiliza
           * listCalendar(), no loadCalendar().
           */
          if (
            GOF.calendar &&
            typeof GOF.calendar.listCalendar ===
              "function"
          ) {
            await GOF.calendar.listCalendar(
              tournament.id
            );
          }
        }

        break;


      case "schedule":
        requireTournament();
        break;


      case "results":
        {
          const tournament =
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
        }

        break;


      case "standings":
        {
          const tournament =
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
        }

        break;


      case "playoffs":
        {
          const tournament =
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
        {
          const tournament =
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
        }

        break;


      default:
        break;
    }
  }


  /* =====================================================
     CONTEXTO ACTUAL
  ===================================================== */

  async function refreshCurrentContext() {
    requireSession();

    clearError();

    let league =
      getActiveLeague();

    /*
     * Si no tenemos liga activa,
     * consultamos las ligas disponibles.
     */
    if (
      !league ||
      !league.id
    ) {
      const leagues =
        await loadLeagues();

      if (
        Array.isArray(leagues) &&
        leagues.length === 1
      ) {
        league =
          leagues[0];

        GOF.context =
          GOF.context || {};

        GOF.context.activeLeague =
          league;

        if (
          GOF.leagues &&
          typeof GOF.leagues.setActiveLeague ===
            "function"
        ) {
          await GOF.leagues.setActiveLeague(
            league.id
          );
        }
      }
    }

    if (!league) {
      return;
    }

    setText(
      "#active-league-name",
      league.name
    );

    await loadTournaments();

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

        const errorBox =
          $("#login-error");

        clearError(
          errorBox
        );

        const email =
          $("#login-email")
            ?.value
            ?.trim();

        const password =
          $("#login-password")
            ?.value ||
          "";

        if (!email) {
          showError(
            new Error(
              "Escribe tu correo electrónico."
            ),
            errorBox
          );
          return;
        }

        if (!password) {
          showError(
            new Error(
              "Escribe tu contraseña."
            ),
            errorBox
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

            GOF.user =
              GOF.session?.user ||
              null;
          }

          if (!GOF.session) {
            throw new Error(
              "No se pudo establecer la sesión."
            );
          }

          form.reset();

          hideLoading();

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
            errorBox
          );
        }
      }
    );
  }


  /* =====================================================
     NAVEGACIÓN
  ===================================================== */

  function bindNavigation() {
    $$(
      "[data-gof-nav]"
    ).forEach(button => {

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
    });
  }


  /* =====================================================
     ACCIONES GENERALES
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
        async () => {
          try {
            await refreshDashboard();
          } catch (error) {
            showError(error);
          }
        }
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
              !GOF.auth ||
              typeof GOF.auth.logout !==
                "function"
            ) {
              throw new Error(
                "La función de cierre de sesión no está disponible."
              );
            }

            await GOF.auth.logout();

            GOF.session =
              null;

            GOF.user =
              null;

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


    $$(
      "[data-action]"
    ).forEach(button => {

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
                console.warn(
                  "GAME ON FLAG: acción no implementada:",
                  action
                );
                break;
            }

          } catch (error) {
            hideLoading();
            showError(error);
          }
        }
      );
    });
  }


  /* =====================================================
     INICIO
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

      if (
        !auth ||
        !auth.session
      ) {
        hideLoading();

        showLoginView();

        return;
      }

      GOF.session =
        auth.session;

      GOF.user =
        auth.user ||
        auth.session.user;

      hideLoading();

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
     API PÚBLICA DEL CONTROLADOR
  ===================================================== */

  GOF.ui.$ =
    $;

  GOF.ui.$$ =
    $$;

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

  GOF.ui.loadLeagues =
    loadLeagues;

  GOF.ui.loadTournaments =
    loadTournaments;

  GOF.ui.loadViewData =
    loadViewData;

  GOF.ui.boot =
    boot;


  /* =====================================================
     ARRANQUE
  ===================================================== */

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
