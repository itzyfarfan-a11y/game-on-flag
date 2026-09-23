/* GAME ON FLAG — Portal Público */
(function () {
  "use strict";

  function sb() {
    if (!window.GOF || !window.GOF.supabase) {
      throw new Error("Supabase no está inicializado.");
    }

    return window.GOF.supabase;
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function requireSlug(slug) {
    const value = cleanText(slug);

    if (!value) {
      throw new Error(
        "Falta el identificador público de la liga."
      );
    }

    return value;
  }

  function getSlugFromUrl() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const querySlug =
      cleanText(
        params.get("liga") ||
        params.get("league") ||
        params.get("slug")
      );

    if (querySlug) {
      return querySlug;
    }

    const parts =
      window.location.pathname
        .split("/")
        .map(cleanText)
        .filter(Boolean);

    /*
     * Soporta:
     *
     * /liga/nffl
     * /league/nffl
     * /public/nffl
     *
     * y, como fallback:
     *
     * /nffl
     */
    const markerIndex =
      parts.findIndex(part =>
        [
          "liga",
          "league",
          "public"
        ].includes(
          part.toLowerCase()
        )
      );

    if (
      markerIndex >= 0 &&
      parts[markerIndex + 1]
    ) {
      return parts[
        markerIndex + 1
      ];
    }

    return (
      parts[parts.length - 1] ||
      ""
    );
  }

  async function getLeagueBySlug(
    leagueSlug
  ) {
    const slug =
      requireSlug(
        leagueSlug
      );

    const {
      data,
      error
    } = await sb()
      .rpc(
        "public_get_league_by_slug",
        {
          p_league_slug:
            slug
        }
      );

    if (error) throw error;

    if (
      Array.isArray(data)
    ) {
      return data[0] || null;
    }

    return data || null;
  }

  async function listTournaments(
    leagueSlug
  ) {
    const slug =
      requireSlug(
        leagueSlug
      );

    const {
      data,
      error
    } = await sb()
      .rpc(
        "public_list_tournaments",
        {
          p_league_slug:
            slug
        }
      );

    if (error) throw error;

    return data || [];
  }

  async function getTournamentData({
    tournamentId,
    categoryId = null,
    leagueSlug
  }) {
    requireSlug(
      leagueSlug
    );

    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    const {
      data,
      error
    } = await sb()
      .rpc(
        "public_get_tournament_data",
        {
          p_tournament_id:
            tournamentId,
          p_category_id:
            categoryId,
          p_league_slug:
            leagueSlug
        }
      );

    if (error) throw error;

    return data || {};
  }

  async function getPublicRoster({
    tournamentId,
    categoryId,
    teamId,
    leagueSlug
  }) {
    if (
      !tournamentId ||
      !categoryId ||
      !teamId
    ) {
      throw new Error(
        "Faltan datos para consultar el roster."
      );
    }

    requireSlug(
      leagueSlug
    );

    const {
      data,
      error
    } = await sb()
      .rpc(
        "public_get_roster",
        {
          p_tournament_id:
            tournamentId,
          p_category_id:
            categoryId,
          p_team_id:
            teamId,
          p_league_slug:
            leagueSlug
        }
      );

    if (error) throw error;

    return data || [];
  }

  async function listPublicNotices(
    leagueSlug
  ) {
    const slug =
      requireSlug(
        leagueSlug
      );

    const {
      data,
      error
    } = await sb()
      .rpc(
        "public_list_notices",
        {
          p_league_slug:
            slug
        }
      );

    if (error) throw error;

    return data || [];
  }

  async function loadPublicLeague(
    leagueSlug = null
  ) {
    const slug =
      requireSlug(
        leagueSlug ||
        getSlugFromUrl()
      );

    const league =
      await getLeagueBySlug(
        slug
      );

    if (!league) {
      throw new Error(
        "No se encontró la liga pública."
      );
    }

    const [
      tournaments,
      notices
    ] = await Promise.all([
      listTournaments(
        slug
      ),
      listPublicNotices(
        slug
      )
    ]);

    return {
      slug,
      league,
      tournaments,
      notices
    };
  }

  async function loadPublicTournament({
    leagueSlug,
    tournamentId,
    categoryId = null
  }) {
    const slug =
      requireSlug(
        leagueSlug
      );

    const [
      tournamentData,
      notices
    ] = await Promise.all([
      getTournamentData({
        tournamentId,
        categoryId,
        leagueSlug:
          slug
      }),
      listPublicNotices(
        slug
      )
    ]);

    return {
      slug,
      tournament:
        tournamentData,
      notices
    };
  }

  function formatDate(
    value
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return new Intl.DateTimeFormat(
      "es-MX",
      {
        dateStyle:
          "medium"
      }
    ).format(date);
  }

  function formatTime(
    value
  ) {
    if (!value) {
      return "";
    }

    const text =
      String(value);

    if (
      /^\d{2}:\d{2}/.test(
        text
      )
    ) {
      return text.slice(
        0,
        5
      );
    }

    return text;
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

  function renderLeagueHeader(
    container,
    league
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el encabezado público."
      );
    }

    const data =
      league || {};

    container.innerHTML = `
      <div class="gof-public-brand">
        ${
          data.logo_url
            ? `
              <img
                src="${escapeHtml(
                  data.logo_url
                )}"
                alt="${escapeHtml(
                  data.name ||
                    "Liga"
                )}"
                loading="eager"
              >
            `
            : ""
        }

        <div>
          <h1>
            ${escapeHtml(
              data.name ||
                "GAME ON FLAG"
            )}
          </h1>

          ${
            data.description
              ? `
                <p>
                  ${escapeHtml(
                    data.description
                  )}
                </p>
              `
              : ""
          }
        </div>
      </div>
    `;

    return container;
  }

  function renderTournamentList(
    container,
    tournaments
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el contenedor de torneos."
      );
    }

    container.innerHTML = "";

    if (
      !tournaments ||
      tournaments.length === 0
    ) {
      container.innerHTML = `
        <div class="gof-empty-state">
          No hay torneos publicados.
        </div>
      `;

      return container;
    }

    tournaments.forEach(
      tournament => {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "gof-public-tournament";

        card.dataset.tournamentId =
          tournament.id;

        card.innerHTML = `
          <div>
            <h3>
              ${escapeHtml(
                tournament.name ||
                  "Torneo"
              )}
            </h3>

            ${
              tournament.start_date
                ? `
                  <small>
                    Inicio:
                    ${escapeHtml(
                      formatDate(
                        tournament.start_date
                      )
                    )}
                  </small>
                `
                : ""
            }

            ${
              tournament.end_date
                ? `
                  <small>
                    Fin:
                    ${escapeHtml(
                      formatDate(
                        tournament.end_date
                      )
                    )}
                  </small>
                `
                : ""
            }
          </div>
        `;

        container.appendChild(
          card
        );
      }
    );

    return container;
  }

  function renderNotices(
    container,
    notices
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el contenedor público de avisos."
      );
    }

    container.innerHTML = "";

    if (
      !notices ||
      notices.length === 0
    ) {
      container.innerHTML = `
        <div class="gof-empty-state">
          No hay avisos publicados.
        </div>
      `;

      return container;
    }

    notices.forEach(
      notice => {
        const article =
          document.createElement(
            "article"
          );

        article.className =
          "gof-public-notice";

        article.innerHTML = `
          <h3>
            ${escapeHtml(
              notice.title
            )}
          </h3>

          <p>
            ${escapeHtml(
              notice.message
            )}
          </p>

          ${
            notice.published_at
              ? `
                <small>
                  ${escapeHtml(
                    formatDate(
                      notice.published_at
                    )
                  )}
                </small>
              `
              : ""
          }
        `;

        container.appendChild(
          article
        );
      }
    );

    return container;
  }

  function renderRoster(
    container,
    players
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el contenedor de roster público."
      );
    }

    container.innerHTML = "";

    if (
      !players ||
      players.length === 0
    ) {
      container.innerHTML = `
        <div class="gof-empty-state">
          No hay jugadores registrados.
        </div>
      `;

      return container;
    }

    players.forEach(
      player => {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "gof-public-player";

        card.innerHTML = `
          ${
            player.photo_url
              ? `
                <img
                  src="${escapeHtml(
                    player.photo_url
                  )}"
                  alt="${escapeHtml(
                    player.full_name ||
                      "Jugador"
                  )}"
                  loading="lazy"
                >
              `
              : `
                <div class="gof-player-placeholder">
                  ${escapeHtml(
                    player.jersey_number ??
                      ""
                  )}
                </div>
              `
          }

          <div>
            <strong>
              ${escapeHtml(
                player.full_name ||
                  "Jugador"
              )}
            </strong>

            ${
              player.jersey_number !==
              null
                ? `
                  <span>
                    #${escapeHtml(
                      player.jersey_number
                    )}
                  </span>
                `
                : ""
            }
          </div>
        `;

        container.appendChild(
          card
        );
      }
    );

    return container;
  }

  function renderMatches(
    container,
    matches
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el contenedor público de partidos."
      );
    }

    container.innerHTML = "";

    if (
      !matches ||
      matches.length === 0
    ) {
      container.innerHTML = `
        <div class="gof-empty-state">
          No hay partidos publicados.
        </div>
      `;

      return container;
    }

    matches.forEach(
      match => {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "gof-public-match";

        const home =
          match.home_team?.name ||
          match.home_team_name ||
          "Por definir";

        const away =
          match.away_team?.name ||
          match.away_team_name ||
          "Por definir";

        const scoreAvailable =
          match.home_score !==
            null &&
          match.away_score !==
            null;

        card.innerHTML = `
          <div class="gof-public-match-meta">
            <span>
              ${escapeHtml(
                match.category_name ||
                  match.categories?.name ||
                  ""
              )}
            </span>

            ${
              match.round_number
                ? `
                  <span>
                    Jornada ${escapeHtml(
                      match.round_number
                    )}
                  </span>
                `
                : ""
            }
          </div>

          <div class="gof-public-match-date">
            ${
              match.match_date
                ? escapeHtml(
                    formatDate(
                      match.match_date
                    )
                  )
                : ""
            }

            ${
              match.match_time
                ? `
                  ·
                  ${escapeHtml(
                    formatTime(
                      match.match_time
                    )
                  )}
                `
                : ""
            }

            ${
              match.field_name
                ? `
                  ·
                  ${escapeHtml(
                    match.field_name
                  )}
                `
                : ""
            }
          </div>

          <div class="gof-public-match-teams">
            <strong>
              ${escapeHtml(home)}
            </strong>

            <span class="gof-public-score">
              ${
                scoreAvailable
                  ? `${escapeHtml(
                      match.home_score
                    )} - ${escapeHtml(
                      match.away_score
                    )}`
                  : "VS"
              }
            </span>

            <strong>
              ${escapeHtml(away)}
            </strong>
          </div>
        `;

        container.appendChild(
          card
        );
      }
    );

    return container;
  }

  function buildPublicLink(
    baseUrl,
    leagueSlug
  ) {
    const base =
      cleanText(baseUrl);

    const slug =
      requireSlug(
        leagueSlug
      );

    if (!base) {
      throw new Error(
        "Falta la dirección base del portal."
      );
    }

    return (
      base.replace(
        /\/+$/,
        ""
      ) +
      "/?liga=" +
      encodeURIComponent(
        slug
      )
    );
  }

  window.GOF =
    window.GOF || {};

  window.GOF.public = {
    getSlugFromUrl,
    getLeagueBySlug,
    listTournaments,
    getTournamentData,
    getPublicRoster,
    listPublicNotices,
    loadPublicLeague,
    loadPublicTournament,
    formatDate,
    formatTime,
    renderLeagueHeader,
    renderTournamentList,
    renderNotices,
    renderRoster,
    renderMatches,
    buildPublicLink
  };
})();
