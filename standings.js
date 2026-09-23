/* GAME ON FLAG — Tabla / Standings */
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

  function requireTournament(tournamentId) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    return tournamentId;
  }

  function normalizeName(team) {
    return (
      String(team?.name || "")
        .trim()
        .toLocaleUpperCase("es-MX")
    );
  }

  function createTeamRow(team) {
    return {
      id: team.id,
      name: team.name || "SIN NOMBRE",
      logo_url: team.logo_url || null,

      jj: 0,
      jg: 0,
      jp: 0,

      pa: 0,
      pc: 0,
      dif: 0
    };
  }

  function applyMatch(row, scored, conceded, won) {
    row.jj += 1;
    row.pa += Number(scored || 0);
    row.pc += Number(conceded || 0);

    if (won) {
      row.jg += 1;
    } else {
      row.jp += 1;
    }

    row.dif = row.pa - row.pc;
  }

  function calculateStandings(teams, matches) {
    const table = new Map();

    (teams || []).forEach(team => {
      if (!team || !team.id) return;

      table.set(
        team.id,
        createTeamRow(team)
      );
    });

    (matches || []).forEach(match => {
      if (!match) return;

      if (
        !["jugado", "incomparecencia"].includes(
          match.status
        )
      ) {
        return;
      }

      if (
        match.home_score === null ||
        match.home_score === undefined ||
        match.away_score === null ||
        match.away_score === undefined
      ) {
        return;
      }

      const home = table.get(
        match.home_team_id
      );

      const away = table.get(
        match.away_team_id
      );

      if (!home || !away) {
        return;
      }

      /*
       * Los partidos de preparación/reposición pueden excluir
       * estadísticamente a uno de los equipos.
       */
      const excluded =
        match.is_makeup &&
        match.stats_exclude_team_id
          ? match.stats_exclude_team_id
          : null;

      if (
        excluded !== match.home_team_id
      ) {
        if (
          match.home_score >
          match.away_score
        ) {
          applyMatch(
            home,
            match.home_score,
            match.away_score,
            true
          );
        } else if (
          match.home_score <
          match.away_score
        ) {
          applyMatch(
            home,
            match.home_score,
            match.away_score,
            false
          );
        } else {
          /*
           * El sistema actualmente no usa empates
           * como resultado competitivo.
           */
          applyMatch(
            home,
            match.home_score,
            match.away_score,
            false
          );
        }
      }

      if (
        excluded !== match.away_team_id
      ) {
        if (
          match.away_score >
          match.home_score
        ) {
          applyMatch(
            away,
            match.away_score,
            match.home_score,
            true
          );
        } else if (
          match.away_score <
          match.home_score
        ) {
          applyMatch(
            away,
            match.away_score,
            match.home_score,
            false
          );
        } else {
          applyMatch(
            away,
            match.away_score,
            match.home_score,
            false
          );
        }
      }
    });

    const rows = Array.from(
      table.values()
    );

    rows.sort((a, b) => {
      /*
       * Desempate oficial de Game On Flag:
       *
       * 1. DIF
       * 2. PA
       * 3. PC menor
       * 4. Nombre del equipo
       *
       * No se utiliza sistema de 3 puntos
       * por victoria.
       */
      return (
        b.dif - a.dif ||
        b.pa - a.pa ||
        a.pc - b.pc ||
        normalizeName(a).localeCompare(
          normalizeName(b),
          "es-MX"
        )
      );
    });

    return rows.map(
      (row, index) => ({
        ...row,
        pos: index + 1
      })
    );
  }

  async function getTeams(
    tournamentId,
    categoryId
  ) {
    const league = requireLeague();

    let query = sb()
      .from("tournament_teams")
      .select(`
        id,
        team_id,
        category_id,
        active,
        teams (
          id,
          name,
          logo_url,
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
      .eq("active", true);

    if (categoryId) {
      query = query.eq(
        "category_id",
        categoryId
      );
    }

    const {
      data,
      error
    } = await query;

    if (error) throw error;

    return (data || [])
      .filter(row => {
        const teamLeague =
          row.teams &&
          row.teams.league_id;

        const categoryLeague =
          row.categories &&
          row.categories.league_id;

        return (
          teamLeague === league.id &&
          categoryLeague === league.id
        );
      })
      .map(row => ({
        id: row.team_id,
        name:
          row.teams?.name ||
          "SIN NOMBRE",
        logo_url:
          row.teams?.logo_url ||
          null,
        category_id:
          row.category_id
      }));
  }

  async function getMatches(
    tournamentId,
    categoryId
  ) {
    const league = requireLeague();

    let query = sb()
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
        is_makeup,
        stats_exclude_team_id,
        home_team:teams!matches_home_team_id_fkey (
          id,
          name,
          logo_url,
          league_id
        ),
        away_team:teams!matches_away_team_id_fkey (
          id,
          name,
          logo_url,
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
      .in("status", [
        "jugado",
        "incomparecencia"
      ]);

    if (categoryId) {
      query = query.eq(
        "category_id",
        categoryId
      );
    }

    const {
      data,
      error
    } = await query;

    if (error) throw error;

    return (data || []).filter(match => {
      const categoryOk =
        !match.categories ||
        match.categories.league_id ===
          league.id;

      const homeOk =
        !match.home_team ||
        match.home_team.league_id ===
          league.id;

      const awayOk =
        !match.away_team ||
        match.away_team.league_id ===
          league.id;

      return (
        categoryOk &&
        homeOk &&
        awayOk
      );
    });
  }

  async function getStandings(
    tournamentId,
    categoryId = null
  ) {
    requireTournament(
      tournamentId
    );

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

  async function getTeamPosition(
    tournamentId,
    categoryId,
    teamId
  ) {
    if (!teamId) {
      throw new Error(
        "Equipo no válido."
      );
    }

    const standings =
      await getStandings(
        tournamentId,
        categoryId
      );

    return (
      standings.find(
        row => row.id === teamId
      ) || null
    );
  }

  function renderStandings(
    container,
    standings
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el contenedor de la tabla."
      );
    }

    container.innerHTML = "";

    const table =
      document.createElement("div");

    table.className =
      "gof-standings";

    const header =
      document.createElement("div");

    header.className =
      "gof-standings-row gof-standings-header";

    header.innerHTML = `
      <div>POS</div>
      <div>EQUIPO</div>
      <div>JJ</div>
      <div>JG</div>
      <div>JP</div>
      <div>PA</div>
      <div>PC</div>
      <div>DIF</div>
    `;

    table.appendChild(header);

    if (
      !standings ||
      standings.length === 0
    ) {
      const empty =
        document.createElement("div");

      empty.className =
        "gof-empty-state";

      empty.textContent =
        "Aún no hay resultados para generar la tabla.";

      table.appendChild(empty);
      container.appendChild(table);

      return table;
    }

    standings.forEach(row => {
      const item =
        document.createElement("div");

      item.className =
        "gof-standings-row";

      item.dataset.teamId =
        row.id;

      const team =
        document.createElement("div");

      team.className =
        "gof-standing-team";

      if (row.logo_url) {
        const logo =
          document.createElement("img");

        logo.src =
          row.logo_url;

        logo.alt =
          row.name;

        logo.loading =
          "lazy";

        team.appendChild(
          logo
        );
      }

      const name =
        document.createElement("span");

      name.textContent =
        row.name;

      team.appendChild(
        name
      );

      item.innerHTML = `
        <div>${row.pos}</div>
      `;

      item.appendChild(
        team
      );

      item.innerHTML += `
        <div>${row.jj}</div>
        <div>${row.jg}</div>
        <div>${row.jp}</div>
        <div>${row.pa}</div>
        <div>${row.pc}</div>
        <div>${row.dif}</div>
      `;

      table.appendChild(
        item
      );
    });

    container.appendChild(
      table
    );

    return table;
  }

  function getSummary(
    standings
  ) {
    const rows =
      Array.isArray(standings)
        ? standings
        : [];

    return {
      teams: rows.length,

      played: rows.reduce(
        (sum, row) =>
          sum + row.jj,
        0
      ),

      wins: rows.reduce(
        (sum, row) =>
          sum + row.jg,
        0
      ),

      pointsFor: rows.reduce(
        (sum, row) =>
          sum + row.pa,
        0
      ),

      pointsAgainst:
        rows.reduce(
          (sum, row) =>
            sum + row.pc,
          0
        )
    };
  }

  window.GOF =
    window.GOF || {};

  window.GOF.standings = {
    getStandings,
    getTeamPosition,
    calculateStandings,
    renderStandings,
    getSummary
  };
})();
