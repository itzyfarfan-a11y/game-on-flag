/* GAME ON FLAG — Tabla de posiciones */
(function () {
  "use strict";

  function sb() {
    if (!window.GOF || !window.GOF.supabase) {
      throw new Error("Supabase no está inicializado.");
    }

    return window.GOF.supabase;
  }

  function requireLeague() {
    const league =
      window.GOF &&
      window.GOF.context &&
      window.GOF.context.activeLeague;

    if (!league || !league.id) {
      throw new Error("No hay una liga activa.");
    }

    return league;
  }

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  function emptyTeam(team) {
    return {
      team_id: team.id,
      team_name:
        team.name ||
        "SIN NOMBRE",
      jj: 0,
      jg: 0,
      jp: 0,
      pa: 0,
      pc: 0,
      dif: 0
    };
  }

  function isMatchCounted(match) {
    const status =
      String(match.status || "")
        .trim()
        .toLowerCase();

    return [
      "jugado",
      "incomparecencia"
    ].includes(status);
  }

  function calculateStandings(
    teams,
    matches
  ) {
    const table = new Map();

    /*
     * Todos los equipos aparecen,
     * aunque todavía no tengan partidos.
     */
    (teams || []).forEach(team => {
      table.set(
        team.id,
        emptyTeam(team)
      );
    });

    /*
     * Solo cuentan partidos oficiales
     * con resultado:
     *
     * jugado
     * incomparecencia
     */
    (matches || []).forEach(match => {
      if (!isMatchCounted(match)) {
        return;
      }

      const homeId =
        match.home_team_id;

      const awayId =
        match.away_team_id;

      if (!homeId || !awayId) {
        return;
      }

      const home =
        table.get(homeId);

      const away =
        table.get(awayId);

      /*
       * No agregamos equipos que no pertenezcan
       * a la categoría actual.
       */
      if (!home || !away) {
        return;
      }

      /*
       * NOMBRES REALES DE SUPABASE:
       *
       * home_score
       * away_score
       */
      const homeScore =
        Number(
          match.home_score || 0
        );

      const awayScore =
        Number(
          match.away_score || 0
        );

      home.jj++;
      away.jj++;

      home.pa += homeScore;
      home.pc += awayScore;

      away.pa += awayScore;
      away.pc += homeScore;

      if (homeScore > awayScore) {
        home.jg++;
        away.jp++;
      } else if (
        awayScore > homeScore
      ) {
        away.jg++;
        home.jp++;
      }
    });

    /*
     * DIF =
     * Puntos a favor - Puntos contra
     */
    table.forEach(row => {
      row.dif =
        row.pa -
        row.pc;
    });

    /*
     * CRITERIO OFICIAL GAME ON FLAG:
     *
     * 1. JG — más juegos ganados
     * 2. PA — más puntos a favor
     * 3. DIF — mayor diferencia
     * 4. PC — menos puntos contra
     * 5. Nombre — alfabético
     *
     * NO se utiliza sistema de 3 puntos.
     */
    return Array.from(
      table.values()
    ).sort(
      (a, b) =>
        b.jg - a.jg ||
        b.pa - a.pa ||
        b.dif - a.dif ||
        a.pc - b.pc ||
        normalizeName(a.team_name)
          .localeCompare(
            normalizeName(b.team_name),
            "es-MX"
          )
    );
  }

  async function getTeams(
    tournamentId,
    categoryId
  ) {
    requireLeague();

    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    if (!categoryId) {
      throw new Error(
        "Categoría no válida."
      );
    }

    const {
      data,
      error
    } = await sb()
      .from("tournament_teams")
      .select(`
        id,
        team_id,
        category_id,
        active,
        teams (
          id,
          name,
          league_id
        ),
        categories (
          id,
          name,
          league_id
        )
      `)
      .eq(
        "tournament_id",
        tournamentId
      )
      .eq(
        "category_id",
        categoryId
      )
      .eq(
        "active",
        true
      );

    if (error) {
      throw error;
    }

    return (data || [])
      .filter(row =>
        row.teams &&
        row.categories
      )
      .map(row => ({
        id:
          row.team_id,

        name:
          row.teams.name,

        league_id:
          row.teams.league_id,

        category_id:
          row.category_id
      }));
  }

  async function getMatches(
    tournamentId,
    categoryId
  ) {
    requireLeague();

    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    if (!categoryId) {
      throw new Error(
        "Categoría no válida."
      );
    }

    const {
      data,
      error
    } = await sb()
      .from("matches")
      .select(`
        id,
        tournament_id,
        category_id,
        round_number,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status,
        match_date,
        match_time,
        field_name,
        is_makeup,
        stats_exclude_team_id
      `)
      .eq(
        "tournament_id",
        tournamentId
      )
      .eq(
        "category_id",
        categoryId
      )
      .order(
        "round_number",
        {
          ascending: true
        }
      )
      .order(
        "match_date",
        {
          ascending: true,
          nullsFirst: true
        }
      )
      .order(
        "match_time",
        {
          ascending: true,
          nullsFirst: true
        }
      );

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function loadStandings({
    tournamentId,
    categoryId
  }) {
    const [
      teams,
      matches
    ] = await Promise.all([
      getTeams(
        tournamentId,
        categoryId
      ),

      getMatches(
        tournamentId,
        categoryId
      )
    ]);

    return calculateStandings(
      teams,
      matches
    );
  }

  function renderStandings(
    container,
    standings
  ) {
    if (!container) {
      return;
    }

    const rows =
      standings || [];

    if (!rows.length) {
      container.innerHTML = `
        <div class="gof-empty-state">
          No hay equipos registrados.
        </div>
      `;

      return;
    }

    container.innerHTML = `
      <div class="gof-standings-wrap">

        <table class="gof-standings-table">

          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th>JJ</th>
              <th>JG</th>
              <th>JP</th>
              <th>PA</th>
              <th>PC</th>
              <th>DIF</th>
            </tr>
          </thead>

          <tbody>

            ${rows
              .map(
                (row, index) => `
                  <tr>

                    <td>
                      ${index + 1}
                    </td>

                    <td>
                      <strong>
                        ${escapeHtml(
                          row.team_name
                        )}
                      </strong>
                    </td>

                    <td>
                      ${row.jj}
                    </td>

                    <td>
                      ${row.jg}
                    </td>

                    <td>
                      ${row.jp}
                    </td>

                    <td>
                      ${row.pa}
                    </td>

                    <td>
                      ${row.pc}
                    </td>

                    <td class="${
                      row.dif > 0
                        ? "positive"
                        : row.dif < 0
                          ? "negative"
                          : ""
                    }">
                      ${row.dif}
                    </td>

                  </tr>
                `
              )
              .join("")}

          </tbody>

        </table>

      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
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

  window.GOF =
    window.GOF || {};

  window.GOF.standings = {
    calculateStandings,
    getTeams,
    getMatches,
    loadStandings,
    renderStandings
  };
})();
