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

    element.textContent = value ?? "";
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

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat(
        "es-MX",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }
      ).format(new Date(value + "T00:00:00"));
    } catch (error) {
      return String(value);
    }
  }

  function formatTime(value) {
    if (!value) {
      return "—";
    }

    return String(value).slice(0, 5);
  }

  function statusLabel(value) {
    const labels = {
      programado: "Programado",
      jugado: "Jugado",
      cancelado: "Cancelado",
      incomparecencia: "Incomparecencia",
      proximo: "Próximo",
      activo: "Activo",
      finalizado: "Finalizado"
    };

    return labels[value] || value || "—";
  }

  function statusClass(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-");
  }


  /* =====================================================
     LOADING / ERRORES
  ===================================================== */

  function showLoading(message) {
    const element = $("#app-loading");

    if (!element) {
      return;
    }

    element.textContent =
      message || "Cargando...";

    element.hidden = false;
  }

  function hideLoading() {
    const element = $("#app-loading");

    if (element) {
      element.hidden = true;
    }
  }

  function showError(error, container) {
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

    console.error(
      "GAME ON FLAG:",
      error
    );
  }

  function clearError(container) {
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
     CONTEXTO
  ===================================================== */

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

    if (!league || !league.id) {
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
     VISTAS
  ===================================================== */

  function showView(viewName) {
    $$("[data-gof-view]").forEach(
      function (view) {
        view.hidden =
          view.dataset.gofView !==
          viewName;
      }
    );

    $$("[data-gof-nav]").forEach(
      function (button) {
        button.classList.toggle(
          "active",
          button.dataset.gofNav ===
            viewName
        );
      }
    );

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
        function () {
          email.focus();
        },
        50
      );
    }
  }


  /* =====================================================
     RENDER GENÉRICO
  ===================================================== */

  function emptyState(message) {
    return `
      <div class="gof-empty-state">
        ${escapeHtml(
          message || "No hay información disponible."
        )}
      </div>
    `;
  }

  function renderCards(
    containerId,
    items,
    renderer,
    emptyMessage
  ) {
    const container =
      document.getElementById(
        containerId
      );

    if (!container) {
      return;
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      container.innerHTML =
        emptyState(emptyMessage);

      return;
    }

    container.innerHTML =
      items.map(renderer).join("");
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

      GOF.context =
        GOF.context || {};

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

      setText(
        "#dashboard-league-name",
        league?.name ||
          "Sin liga activa"
      );

      const tournament =
        getActiveTournament();

      setText(
        "#dashboard-tournament-name",
        tournament?.name ||
          "Sin torneo seleccionado"
      );

      setText(
        "#dashboard-status",
        tournament
          ? statusLabel(
              tournament.status
            )
          : "Sin torneo"
      );

      hideLoading();

      return result;

    } catch (error) {
      hideLoading();

      if (!getSession()) {
        showLoginView();
        return null;
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

    if (
      !Array.isArray(leagues) ||
      leagues.length === 0
    ) {
      container.innerHTML =
        emptyState(
          "No tienes ligas disponibles."
        );

      return;
    }

    container.innerHTML =
      leagues.map(
        function (league) {
          const current =
            league.membership &&
            league.membership.is_current;

          return `
            <button
              type="button"
              class="gof-league-item ${
                current
                  ? "active"
                  : ""
              }"
              data-league-select="${
                escapeHtml(league.id)
              }"
            >
              <strong>
                ${escapeHtml(
                  league.name ||
                    "Liga"
                )}
              </strong>

              <small>
                ${escapeHtml(
                  league.slug ||
                    ""
                )}
              </small>
            </button>
          `;
        }
      ).join("");

    $$("[data-league-select]")
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            async function () {
              const leagueId =
                button.dataset
                  .leagueSelect;

              try {
                showLoading(
                  "Cambiando de liga..."
                );

                await GOF.leagues
                  .setActiveLeague(
                    leagueId
                  );

                const league =
                  leagues.find(
                    function (item) {
                      return (
                        item.id ===
                        leagueId
                      );
                    }
                  );

                GOF.context.activeLeague =
                  league || null;

                GOF.context.activeTournament =
                  null;

                setText(
                  "#active-league-name",
                  league?.name || ""
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
        }
      );
  }


  /* =====================================================
     CREAR LIGA
  ===================================================== */

  async function createLeagueFromAction() {
    requireSession();

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

    GOF.context.activeLeague =
      created || null;

    GOF.context.activeTournament =
      null;

    await loadLeagues();

    hideLoading();

    showView("leagues");
  }


  /* =====================================================
     TORNEOS
  ===================================================== */

  async function loadTournaments() {
    requireSession();
    requireLeague();

    showLoading(
      "Cargando torneos..."
    );

    const tournaments =
      await GOF.tournaments
        .listTournaments();

    renderTournamentSelector(
      tournaments
    );

    hideLoading();

    return tournaments;
  }

  function renderTournamentSelector(
    tournaments
  ) {
    const container =
      $("#tournament-list");

    if (!container) {
      return;
    }

    if (
      !Array.isArray(tournaments) ||
      tournaments.length === 0
    ) {
      container.innerHTML =
        emptyState(
          "No hay torneos registrados."
        );

      return;
    }

    container.innerHTML =
      tournaments.map(
        function (tournament) {
          const active =
            getActiveTournament()?.id ===
            tournament.id;

          return `
            <button
              type="button"
              class="gof-tournament-item ${
                active
                  ? "active"
                  : ""
              }"
              data-tournament-select="${
                escapeHtml(
                  tournament.id
                )
              }"
            >
              <strong>
                ${escapeHtml(
                  tournament.name ||
                    "Torneo"
                )}
              </strong>

              <small>
                ${escapeHtml(
                  statusLabel(
                    tournament.status
                  )
                )}
              </small>
            </button>
          `;
        }
      ).join("");

    $$("[data-tournament-select]")
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            async function () {
              const id =
                button.dataset
                  .tournamentSelect;

              try {
                showLoading(
                  "Abriendo torneo..."
                );

                let tournament =
                  tournaments.find(
                    function (item) {
                      return (
                        item.id === id
                      );
                    }
                  );

                if (
                  GOF.tournaments &&
                  typeof GOF.tournaments
                    .getTournament ===
                    "function"
                ) {
                  const fresh =
                    await GOF.tournaments
                      .getTournament(
                        id
                      );

                  if (fresh) {
                    tournament =
                      fresh;
                  }
                }

                GOF.context.activeTournament =
                  tournament;

                setText(
                  "#active-tournament-name",
                  tournament?.name || ""
                );

                setText(
                  "#active-tournament-status",
                  statusLabel(
                    tournament?.status
                  )
                );

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
        }
      );
  }


  /* =====================================================
     CREAR TORNEO
  ===================================================== */

  async function createTournamentFromAction() {
    requireSession();
    requireLeague();

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

    showLoading(
      "Creando torneo..."
    );

    const tournament =
      await GOF.tournaments
        .createTournament({
          name: cleanName,
          status: "proximo",
          regular_rounds:
            regularRounds,
          tournament_type:
            "regular"
        });

    GOF.context.activeTournament =
      tournament;

    setText(
      "#active-tournament-name",
      tournament?.name ||
        cleanName
    );

    setText(
      "#active-tournament-status",
      statusLabel(
        tournament?.status
      )
    );

    await loadTournaments();

    hideLoading();

    showView("tournament");
  }


  /* =====================================================
     EQUIPOS
  ===================================================== */

  function renderTeams(
    teams
  ) {
    renderCards(
      "teams-content",
      teams,
      function (team) {
        return `
          <article class="gof-card">
            <div class="gof-card-header">
              <div>
                <h3>
                  ${escapeHtml(
                    team.name ||
                      "Equipo"
                  )}
                </h3>

                <p>
                  ${
                    team.club_name
                      ? escapeHtml(
                          team.club_name
                        )
                      : "Sin club/grupo asignado"
                  }
                </p>
              </div>
            </div>

            <div class="gof-card-meta">
              <span>
                ${
                  team.coach_id
                    ? "Coach asignado"
                    : "Sin coach"
                }
              </span>
            </div>
          </article>
        `;
      },
      "No hay equipos registrados en esta liga."
    );
  }


  /* =====================================================
     ENFRENTAMIENTOS
  ===================================================== */

  function renderMatches(
    matches
  ) {
    renderCards(
      "matches-content",
      matches,
      function (match) {
        const home =
          match.home_team?.name ||
          "Local";

        const away =
          match.away_team?.name ||
          "Visitante";

        const score =
          match.home_score !== null &&
          match.away_score !== null
            ? `${match.home_score} - ${match.away_score}`
            : "vs";

        return `
          <article class="gof-card">
            <div class="gof-card-meta">
              <span>
                Jornada ${escapeHtml(
                  match.round_number
                )}
              </span>

              <span>
                ${escapeHtml(
                  statusLabel(
                    match.status
                  )
                )}
              </span>
            </div>

            <div class="gof-match">
              <strong>
                ${escapeHtml(home)}
              </strong>

              <b>
                ${escapeHtml(score)}
              </b>

              <strong>
                ${escapeHtml(away)}
              </strong>
            </div>

            <div class="gof-card-meta">
              <span>
                ${
                  match.match_date
                    ? formatDate(
                        match.match_date
                      )
                    : "Sin fecha"
                }
              </span>

              <span>
                ${
                  match.match_time
                    ? formatTime(
                        match.match_time
                      )
                    : "Sin hora"
                }
              </span>

              <span>
                ${
                  match.field_name ||
                  "Sin campo"
                }
              </span>
            </div>
          </article>
        `;
      },
      "No hay enfrentamientos registrados."
    );
  }


  /* =====================================================
     CALENDARIO
  ===================================================== */

  function renderCalendar(
    matches
  ) {
    renderCards(
      "calendar-content",
      matches,
      function (match) {
        return `
          <article class="gof-card">
            <div class="gof-card-meta">
              <strong>
                ${escapeHtml(
                  match.category_name ||
                  match.categories?.name ||
                  "Categoría"
                )}
              </strong>

              <span>
                Jornada ${escapeHtml(
                  match.round_number
                )}
              </span>
            </div>

            <h3>
              ${escapeHtml(
                match.home_team?.name ||
                  "Local"
              )}
              vs
              ${escapeHtml(
                match.away_team?.name ||
                  "Visitante"
              )}
            </h3>

            <div class="gof-card-meta">
              <span>
                ${formatDate(
                  match.match_date
                )}
              </span>

              <span>
                ${formatTime(
                  match.match_time
                )}
              </span>

              <span>
                ${escapeHtml(
                  match.field_name ||
                    "Campo pendiente"
                )}
              </span>
            </div>
          </article>
        `;
      },
      "No hay partidos programados."
    );
  }


  /* =====================================================
     RESULTADOS
  ===================================================== */

  function renderResults(
    results
  ) {
    renderCards(
      "results-content",
      results,
      function (match) {
        return `
          <article class="gof-card">
            <div class="gof-card-meta">
              <span>
                ${escapeHtml(
                  formatDate(
                    match.match_date
                  )
                )}
              </span>

              <span>
                ${escapeHtml(
                  statusLabel(
                    match.status
                  )
                )}
              </span>
            </div>

            <div class="gof-match">
              <strong>
                ${escapeHtml(
                  match.home_team?.name ||
                    "Local"
                )}
              </strong>

              <b>
                ${
                  match.home_score ??
                  "—"
                }
                -
                ${
                  match.away_score ??
                  "—"
                }
              </b>

              <strong>
                ${escapeHtml(
                  match.away_team?.name ||
                    "Visitante"
                )}
              </strong>
            </div>
          </article>
        `;
      },
      "No hay resultados registrados."
    );
  }


  /* =====================================================
     TABLA
  ===================================================== */

  function renderStandings(
    standings
  ) {
    const container =
      $("#standings-content");

    if (!container) {
      return;
    }

    if (
      !Array.isArray(standings) ||
      standings.length === 0
    ) {
      container.innerHTML =
        emptyState(
          "Todavía no hay información para la tabla."
        );

      return;
    }

    container.innerHTML = `
      <div class="gof-table-wrap">
        <table class="gof-table">
          <thead>
            <tr>
              <th>POS</th>
              <th>EQUIPO</th>
              <th>JJ</th>
              <th>JG</th>
              <th>JP</th>
              <th>PA</th>
              <th>PC</th>
              <th>DIF</th>
            </tr>
          </thead>

          <tbody>
            ${standings.map(
              function (team, index) {
                return `
                  <tr>
                    <td>
                      ${
                        team.position ||
                        index + 1
                      }
                    </td>

                    <td>
                      <strong>
                        ${escapeHtml(
                          team.team_name ||
                          team.name ||
                          team.team?.name ||
                          "Equipo"
                        )}
                      </strong>
                    </td>

                    <td>
                      ${team.jj ?? 0}
                    </td>

                    <td>
                      ${team.jg ?? 0}
                    </td>

                    <td>
                      ${
                        team.jp ??
                        Math.max(
                          0,
                          (team.jj || 0) -
                          (team.jg || 0)
                        )
                      }
                    </td>

                    <td>
                      ${team.pa ?? 0}
                    </td>

                    <td>
                      ${
                        team.pc ??
                        team.pe ??
                        0
                      }
                    </td>

                    <td>
                      ${team.dif ?? 0}
                    </td>
                  </tr>
                `;
              }
            ).join("")}
          </tbody>
        </table>
      </div>
    `;
  }


  /* =====================================================
     PLAYOFFS
  ===================================================== */

  function renderPlayoffs(
    data
  ) {
    const container =
      $("#playoffs-content");

    if (!container) {
      return;
    }

    const items =
      Array.isArray(data)
        ? data
        : data?.matches ||
          data?.playoffMatches ||
          [];

    if (!items.length) {
      container.innerHTML =
        emptyState(
          "Los playoffs todavía no están generados."
        );

      return;
    }

    container.innerHTML =
      items.map(
        function (match) {
          return `
            <article class="gof-card">
              <div class="gof-card-meta">
                <span>
                  ${escapeHtml(
                    match.round_name ||
                    match.round ||
                    "Playoff"
                  )}
                </span>
              </div>

              <div class="gof-match">
                <strong>
                  ${escapeHtml(
                    match.team_a?.name ||
                    match.team_a_name ||
                    "Pendiente"
                  )}
                </strong>

                <b>
                  ${
                    match.score_a ??
                    "—"
                  }
                  -
                  ${
                    match.score_b ??
                    "—"
                  }
                </b>

                <strong>
                  ${escapeHtml(
                    match.team_b?.name ||
                    match.team_b_name ||
                    "Pendiente"
                  )}
                </strong>
              </div>
            </article>
          `;
        }
      ).join("");
  }


  /* =====================================================
     VISTAS SECUNDARIAS
  ===================================================== */

  function renderSimpleData(
    containerId,
    data,
    title,
    emptyMessage
  ) {
    const container =
      document.getElementById(
        containerId
      );

    if (!container) {
      return;
    }

    if (
      data === null ||
      data === undefined ||
      (
        Array.isArray(data) &&
        data.length === 0
      )
    ) {
      container.innerHTML =
        emptyState(
          emptyMessage
        );

      return;
    }

    const items =
      Array.isArray(data)
        ? data
        : [data];

    container.innerHTML = `
      <div class="gof-card-list">
        ${items.map(
          function (item) {
            if (
              item &&
              typeof item ===
                "object"
            ) {
              const name =
                item.name ||
                item.title ||
                item.full_name ||
                item.team_name ||
                item.category_name ||
                "Registro";

              return `
                <article class="gof-card">
                  <h3>
                    ${escapeHtml(
                      name
                    )}
                  </h3>

                  <p>
                    ${escapeHtml(
                      title || ""
                    )}
                  </p>
                </article>
              `;
            }

            return `
              <article class="gof-card">
                ${escapeHtml(item)}
              </article>
            `;
          }
        ).join("")}
      </div>
    `;
  }


  /* =====================================================
     ROSTER
  ===================================================== */

  function renderRoster(data) {
    renderSimpleData(
      "roster-content",
      data,
      "Roster del torneo",
      "Selecciona un equipo para consultar su roster."
    );
  }


  /* =====================================================
     CREDENCIALES
  ===================================================== */

  function renderCredentials(
    data
  ) {
    renderSimpleData(
      "credentials-content",
      data,
      "Credenciales",
      "No hay jugadores disponibles para generar credenciales."
    );
  }


  /* =====================================================
     SPORTWEY
  ===================================================== */

  function renderSportwey(
    data
  ) {
    renderSimpleData(
      "sportwey-content",
      data,
      "Revisión interna",
      "No hay revisiones registradas."
    );
  }


  /* =====================================================
     FINANZAS
  ===================================================== */

  function renderFinance(
    data
  ) {
    const summary =
      $("#finance-summary");

    const container =
      $("#finance-content");

    if (summary) {
      const s =
        data?.summary ||
        data ||
        {};

      summary.innerHTML = `
        <div class="gof-summary-grid">

          <div class="gof-summary-card">
            <span>Cargos</span>
            <strong>
              ${escapeHtml(
                String(
                  s.totalCharges ??
                  s.charges ??
                  0
                )
              )}
            </strong>
          </div>

          <div class="gof-summary-card">
            <span>Pagos</span>
            <strong>
              ${escapeHtml(
                String(
                  s.totalPayments ??
                  s.payments ??
                  0
                )
              )}
            </strong>
          </div>

          <div class="gof-summary-card">
            <span>Gastos</span>
            <strong>
              ${escapeHtml(
                String(
                  s.totalExpenses ??
                  s.expenses ??
                  0
                )
              )}
            </strong>
          </div>
        </div>
      `;
    }

    if (container) {
      container.innerHTML =
        data
          ? `
            <article class="gof-card">
              <h3>
                Resumen de contabilidad
              </h3>

              <p>
                Los movimientos financieros
                están disponibles en el módulo
                de Contabilidad.
              </p>
            </article>
          `
          : emptyState(
              "No hay información financiera disponible."
            );
    }
  }


  /* =====================================================
     AVISOS
  ===================================================== */

  function renderNotices(
    notices
  ) {
    renderCards(
      "notices-content",
      notices,
      function (notice) {
        return `
          <article class="gof-card">

            <div class="gof-card-meta">
              <span>
                ${notice.published
                  ? "Publicado"
                  : "Borrador"}
              </span>
            </div>

            <h3>
              ${escapeHtml(
                notice.title ||
                notice.name ||
                "Aviso"
              )}
            </h3>

            <p>
              ${escapeHtml(
                notice.body ||
                notice.content ||
                notice.description ||
                ""
              )}
            </p>

          </article>
        `;
      },
      "No hay avisos registrados."
    );
  }


  /* =====================================================
     CONFIGURACIÓN
  ===================================================== */

  function renderSettings(
    data
  ) {
    renderSimpleData(
      "settings-content",
      data,
      "Configuración de liga",
      "No hay información de configuración."
    );
  }


  /* =====================================================
     PUBLICACIÓN
  ===================================================== */

  function renderPublish(
    data
  ) {
    const state =
      $("#publication-state");

    const container =
      $("#publish-content");

    if (state) {
      state.innerHTML = `
        <div class="gof-card">
          <h3>
            Estado de publicación
          </h3>

          <p>
            ${
              data
                ? "Información de publicación disponible."
                : "Sin información."
            }
          </p>
        </div>
      `;
    }

    if (container) {
      container.innerHTML =
        data
          ? `
            <article class="gof-card">
              <h3>
                Publicación del torneo
              </h3>

              <p>
                Utiliza este módulo para
                controlar qué partidos,
                resultados y playoffs
                son visibles públicamente.
              </p>
            </article>
          `
          : emptyState(
              "No hay información de publicación."
            );
    }
  }


  /* =====================================================
     CARGA DEL TORNEO
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

    const categories =
      await GOF.categories
        .listCategories();

    const teams =
      await GOF.teams
        .listTeams();

    return {
      categories,
      teams
    };
  }


  /* =====================================================
     CARGA DE VISTAS
  ===================================================== */

  async function loadViewData(
    view
  ) {
    switch (view) {

      case "dashboard":
        return refreshDashboard();


      case "leagues":
        return loadLeagues();


      case "tournaments":
        return loadTournaments();


      case "categories": {
        requireLeague();

        const data =
          await GOF.categories
            .listCategories();

        renderSimpleData(
          "categories-content",
          data,
          "Categorías",
          "No hay categorías registradas."
        );

        return data;
      }


      case "teams": {
        requireLeague();

        const data =
          await GOF.teams
            .listTeams();

        renderTeams(data);

        return data;
      }


      case "roster": {
        const tournament =
          requireTournament();

        const teams =
          await GOF.teams
            .listTeams();

        renderRoster(teams);

        return teams;
      }


      case "credentials": {
        const tournament =
          requireTournament();

        const teams =
          await GOF.teams
            .listTeams();

        renderCredentials(
          teams
        );

        return teams;
      }


      case "sportwey": {
        requireLeague();

        if (
          !GOF.sportwey ||
          typeof GOF.sportwey
            .listPlayerReviews !==
            "function"
        ) {
          return [];
        }

        const data =
          await GOF.sportwey
            .listPlayerReviews();

        renderSportwey(data);

        return data;
      }


      case "matches": {
        const tournament =
          requireTournament();

        const data =
          await GOF.matches
            .listMatches(
              tournament.id
            );

        renderMatches(data);

        return data;
      }


      case "calendar": {
        const tournament =
          requireTournament();

        const data =
          await GOF.calendar
            .listCalendar(
              tournament.id
            );

        renderCalendar(data);

        return data;
      }


      case "schedule": {
        const tournament =
          requireTournament();

        if (
          GOF.schedule &&
          typeof GOF.schedule
            .getScheduledMatches ===
            "function"
        ) {
          const data =
            await GOF.schedule
              .getScheduledMatches(
                tournament.id
              );

          renderCalendar(data);

          return data;
        }

        return [];
      }


      case "results": {
        const tournament =
          requireTournament();

        const data =
          await GOF.results
            .listResults(
              tournament.id
            );

        renderResults(data);

        return data;
      }


      case "standings": {
        const tournament =
          requireTournament();

        const data =
          await GOF.standings
            .getStandings(
              tournament.id
            );

        renderStandings(data);

        return data;
      }


      case "playoffs": {
        const tournament =
          requireTournament();

        const data =
          await GOF.playoffs
            .getPlayoffs(
              tournament.id
            );

        renderPlayoffs(data);

        return data;
      }


      case "finance": {
        requireLeague();

        const data =
          await GOF.finance
            .getDashboard();

        renderFinance(data);

        return data;
      }


      case "notices": {
        requireLeague();

        const data =
          await GOF.notices
            .listNotices();

        renderNotices(data);

        return data;
      }


      case "settings": {
        requireLeague();

        const data =
          await GOF.settings
            .getLeague();

        renderSettings(data);

        return data;
      }


      case "publish": {
        const tournament =
          requireTournament();

        const data =
          await GOF.publish
            .getPublicationSummary(
              tournament.id
            );

        renderPublish(data);

        return data;
      }


      default:
        return null;
    }
  }


  /* =====================================================
     CONTEXTO
  ===================================================== */

  async function refreshCurrentContext() {
    requireSession();

    let league =
      getActiveLeague();

    if (!league || !league.id) {
      const leagues =
        await loadLeagues();

      if (
        Array.isArray(leagues) &&
        leagues.length === 1
      ) {
        league =
          leagues[0];

        GOF.context.activeLeague =
          league;

        await GOF.leagues
          .setActiveLeague(
            league.id
          );
      }
    }

    if (!league) {
      return null;
    }

    setText(
      "#active-league-name",
      league.name
    );

    await loadTournaments();

    await refreshDashboard();

    return league;
  }


  /* =====================================================
     LOGIN
  ===================================================== */

  function bindLogin() {
    const form =
      $("#login-form");

    if (!form ||
        form.dataset.bound === "true") {
      return;
    }

    form.dataset.bound =
      "true";

    form.addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        const errorBox =
          $("#login-error");

        clearError(errorBox);

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

          const result =
            await GOF.auth.signIn(
              email,
              password
            );

          GOF.session =
            result.session;

          GOF.user =
            result.user ||
            result.session?.user ||
            null;

          if (!GOF.session) {
            throw new Error(
              "No se pudo establecer la sesión."
            );
          }

          form.reset();

          await refreshCurrentContext();

          hideLoading();

          showView(
            getActiveLeague()
              ? "dashboard"
              : "leagues"
          );

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
    $$("[data-gof-nav]")
      .forEach(
        function (button) {

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
            async function () {

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
        async function () {
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
        async function () {
          try {
            await GOF.auth.logout();

            GOF.session = null;
            GOF.user = null;

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


    $$("[data-action]")
      .forEach(
        function (button) {

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
            async function () {

              try {
                clearError();

                switch (
                  button.dataset.action
                ) {

                  case "create-league":
                    await createLeagueFromAction();
                    break;

                  case "create-tournament":
                    await createTournamentFromAction();
                    break;

                  default:
                    console.warn(
                      "GAME ON FLAG: acción no implementada:",
                      button.dataset.action
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

      await refreshCurrentContext();

      hideLoading();

      showView(
        getActiveLeague()
          ? "dashboard"
          : "leagues"
      );

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
     API PÚBLICA
  ===================================================== */

  GOF.ui.$ = $;
  GOF.ui.$$ = $$;
  GOF.ui.showView = showView;
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
