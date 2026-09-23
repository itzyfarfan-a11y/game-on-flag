/* GAME ON FLAG — Playoffs */
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

  function validateId(id, message) {
    if (!id) {
      throw new Error(message);
    }

    return id;
  }

  async function getTournament(tournamentId) {
    validateId(
      tournamentId,
      "Torneo no válido."
    );

    const league = requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("tournaments")
      .select(`
        id,
        name,
        status,
        league_id,
        playoff_status
      `)
      .eq("id", tournamentId)
      .eq("league_id", league.id)
      .single();

    if (error) throw error;

    return data;
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
        tournament_id,
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
      .eq("active", true)
      .eq(
        "category_id",
        categoryId
      );

    const {
      data,
      error
    } = await query;

    if (error) throw error;

    return (data || [])
      .filter(row => {
        return (
          row.teams?.league_id === league.id &&
          row.categories?.league_id === league.id
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
        tournament_team_id:
          row.id
      }));
  }

  async function getRegularMatches(
    tournamentId,
    categoryId
  ) {
    const league = requireLeague();

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
      .eq(
        "category_id",
        categoryId
      )
      .in("status", [
        "jugado",
        "incomparecencia"
      ]);

    if (error) throw error;

    return (data || []).filter(match => {
      return (
        (!match.categories ||
          match.categories.league_id ===
            league.id) &&
        (!match.home_team ||
          match.home_team.league_id ===
            league.id) &&
        (!match.away_team ||
          match.away_team.league_id ===
            league.id)
      );
    });
  }

  function calculateRanking(
    teams,
    matches
  ) {
    const table = new Map();

    (teams || []).forEach(team => {
      table.set(team.id, {
        id: team.id,
        name: team.name,
        logo_url: team.logo_url,
        jj: 0,
        jg: 0,
        jp: 0,
        pa: 0,
        pc: 0,
        dif: 0
      });
    });

    (matches || []).forEach(match => {
      if (
        ![
          "jugado",
          "incomparecencia"
        ].includes(match.status)
      ) {
        return;
      }

      if (
        match.home_score === null ||
        match.away_score === null
      ) {
        return;
      }

      const home =
        table.get(
          match.home_team_id
        );

      const away =
        table.get(
          match.away_team_id
        );

      if (!home || !away) {
        return;
      }

      const excluded =
        match.is_makeup &&
        match.stats_exclude_team_id
          ? match.stats_exclude_team_id
          : null;

      if (
        excluded !==
        match.home_team_id
      ) {
        home.jj++;
        home.pa +=
          Number(match.home_score);
        home.pc +=
          Number(match.away_score);

        if (
          Number(match.home_score) >
          Number(match.away_score)
        ) {
          home.jg++;
        } else {
          home.jp++;
        }

        home.dif =
          home.pa - home.pc;
      }

      if (
        excluded !==
        match.away_team_id
      ) {
        away.jj++;
        away.pa +=
          Number(match.away_score);
        away.pc +=
          Number(match.home_score);

        if (
          Number(match.away_score) >
          Number(match.home_score)
        ) {
          away.jg++;
        } else {
          away.jp++;
        }

        away.dif =
          away.pa - away.pc;
      }
    });

    return Array.from(
      table.values()
    ).sort(
      (a, b) =>
        b.dif - a.dif ||
        b.pa - a.pa ||
        a.pc - b.pc ||
        String(a.name).localeCompare(
          String(b.name),
          "es-MX"
        )
    );
  }

  function getQualifierCount(
    teamCount
  ) {
    if (teamCount >= 11) {
      return 8;
    }

    if (teamCount >= 8) {
      return 4;
    }

    if (teamCount >= 2) {
      return 2;
    }

    return 0;
  }

  async function getExistingPlayoffs(
    tournamentId,
    categoryId
  ) {
    const {
      data,
      error
    } = await sb()
      .from("playoff_matches")
      .select(`
        id,
        tournament_id,
        category_id,
        round_number,
        playoff_stage,
        seed_a,
        seed_b,
        team_a_id,
        team_b_id,
        score_a,
        score_b,
        winner_team_id,
        playoff_mode,
        match_date,
        match_time,
        field_name,
        published
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
        "seed_a",
        {
          ascending: true,
          nullsFirst: true
        }
      );

    if (error) throw error;

    return data || [];
  }

  function hasPlayoffResults(
    playoffMatches
  ) {
    return (
      playoffMatches || []
    ).some(match =>
      match.winner_team_id ||
      match.score_a !== null ||
      match.score_b !== null ||
      match.published
    );
  }

  function buildBracket(
    qualifiers
  ) {
    const count =
      qualifiers.length;

    const bracket = [];

    if (count === 8) {
      const pairings = [
        [1, 8],
        [4, 5],
        [2, 7],
        [3, 6]
      ];

      pairings.forEach(
        (pair, index) => {
          bracket.push({
            playoff_stage:
              "cuartos",
            round_number: 1,
            seed_a: pair[0],
            seed_b: pair[1],
            team_a_id:
              qualifiers[
                pair[0] - 1
              ].id,
            team_b_id:
              qualifiers[
                pair[1] - 1
              ].id,
            playoff_mode:
              "automatic"
          });
        }
      );

      bracket.push(
        {
          playoff_stage: "semifinal",
          round_number: 2,
          seed_a: 1,
          seed_b: 2,
          team_a_id: null,
          team_b_id: null,
          playoff_mode: "automatic"
        },
        {
          playoff_stage: "semifinal",
          round_number: 2,
          seed_a: 3,
          seed_b: 4,
          team_a_id: null,
          team_b_id: null,
          playoff_mode: "automatic"
        },
        {
          playoff_stage: "final",
          round_number: 3,
          seed_a: 1,
          seed_b: 2,
          team_a_id: null,
          team_b_id: null,
          playoff_mode: "automatic"
        }
      );

      return bracket;
    }

    if (count === 4) {
      bracket.push(
        {
          playoff_stage: "semifinal",
          round_number: 1,
          seed_a: 1,
          seed_b: 4,
          team_a_id:
            qualifiers[0].id,
          team_b_id:
            qualifiers[3].id,
          playoff_mode: "automatic"
        },
        {
          playoff_stage: "semifinal",
          round_number: 1,
          seed_a: 2,
          seed_b: 3,
          team_a_id:
            qualifiers[1].id,
          team_b_id:
            qualifiers[2].id,
          playoff_mode: "automatic"
        },
        {
          playoff_stage: "final",
          round_number: 2,
          seed_a: 1,
          seed_b: 2,
          team_a_id: null,
          team_b_id: null,
          playoff_mode: "automatic"
        }
      );

      return bracket;
    }

    if (count === 2) {
      bracket.push({
        playoff_stage: "final",
        round_number: 1,
        seed_a: 1,
        seed_b: 2,
        team_a_id:
          qualifiers[0].id,
        team_b_id:
          qualifiers[1].id,
        playoff_mode: "automatic"
      });

      return bracket;
    }

    return bracket;
  }

  async function createPlayoffMatches(
    tournamentId,
    categoryId,
    bracket
  ) {
    if (
      !bracket ||
      bracket.length === 0
    ) {
      throw new Error(
        "No se pudo generar la llave de playoffs."
      );
    }

    const payload =
      bracket.map(item => ({
        tournament_id:
          tournamentId,
        category_id:
          categoryId,
        round_number:
          item.round_number,
        playoff_stage:
          item.playoff_stage,
        seed_a:
          item.seed_a,
        seed_b:
          item.seed_b,
        team_a_id:
          item.team_a_id,
        team_b_id:
          item.team_b_id,
        score_a: null,
        score_b: null,
        winner_team_id: null,
        playoff_mode:
          item.playoff_mode,
        published: false
      }));

    const {
      data,
      error
    } = await sb()
      .from("playoff_matches")
      .insert(payload)
      .select();

    if (error) throw error;

    return data || [];
  }

  async function generatePlayoffs({
    tournamentId,
    categoryId
  }) {
    validateId(
      tournamentId,
      "Torneo no válido."
    );

    validateId(
      categoryId,
      "Categoría no válida."
    );

    const tournament =
      await getTournament(
        tournamentId
      );

    if (
      tournament.status !==
      "activo"
    ) {
      throw new Error(
        "Los playoffs solo pueden generarse cuando el torneo está activo."
      );
    }

    const [
      teams,
      matches,
      existing
    ] = await Promise.all([
      getTeams(
        tournamentId,
        categoryId
      ),
      getRegularMatches(
        tournamentId,
        categoryId
      ),
      getExistingPlayoffs(
        tournamentId,
        categoryId
      )
    ]);

    if (
      existing.length > 0
    ) {
      if (
        hasPlayoffResults(
          existing
        )
      ) {
        throw new Error(
          "La llave de playoffs ya tiene resultados o publicaciones y no puede regenerarse."
        );
      }

      throw new Error(
        "Ya existe una llave de playoffs para esta categoría."
      );
    }

    if (
      teams.length < 2
    ) {
      throw new Error(
        "Se necesitan al menos 2 equipos."
      );
    }

    /*
     * La base de datos también valida que la fase regular
     * esté completamente terminada antes de aceptar
     * la inserción de playoffs.
     */
    const ranking =
      calculateRanking(
        teams,
        matches
      );

    const qualifierCount =
      getQualifierCount(
        ranking.length
      );

    if (
      qualifierCount === 0
    ) {
      throw new Error(
        "No hay suficientes equipos para generar playoffs."
      );
    }

    const qualifiers =
      ranking.slice(
        0,
        qualifierCount
      );

    const bracket =
      buildBracket(
        qualifiers
      );

    return createPlayoffMatches(
      tournamentId,
      categoryId,
      bracket
    );
  }

  async function getPlayoffs(
    tournamentId,
    categoryId
  ) {
    validateId(
      tournamentId,
      "Torneo no válido."
    );

    validateId(
      categoryId,
      "Categoría no válida."
    );

    requireLeague();

    return getExistingPlayoffs(
      tournamentId,
      categoryId
    );
  }

  async function savePlayoffResult({
    playoffMatchId,
    scoreA,
    scoreB
  }) {
    validateId(
      playoffMatchId,
      "Partido de playoffs no válido."
    );

    const {
      data: match,
      error: loadError
    } = await sb()
      .from("playoff_matches")
      .select(`
        id,
        tournament_id,
        category_id,
        round_number,
        playoff_stage,
        team_a_id,
        team_b_id,
        score_a,
        score_b,
        winner_team_id,
        published
      `)
      .eq(
        "id",
        playoffMatchId
      )
      .single();

    if (loadError) {
      throw loadError;
    }

    if (!match) {
      throw new Error(
        "No se encontró el partido de playoffs."
      );
    }

    if (
      !match.team_a_id ||
      !match.team_b_id
    ) {
      throw new Error(
        "El partido todavía no tiene ambos equipos definidos."
      );
    }

    if (match.published) {
      throw new Error(
        "El partido ya fue publicado y no puede modificarse."
      );
    }

    const a =
      Number(scoreA);

    const b =
      Number(scoreB);

    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0
    ) {
      throw new Error(
        "Los marcadores de playoffs no son válidos."
      );
    }

    if (a === b) {
      throw new Error(
        "Un partido de playoffs no puede terminar empatado."
      );
    }

    const winner =
      a > b
        ? match.team_a_id
        : match.team_b_id;

    const {
      data,
      error
    } = await sb()
      .from("playoff_matches")
      .update({
        score_a: a,
        score_b: b,
        winner_team_id:
          winner
      })
      .eq(
        "id",
        playoffMatchId
      )
      .select()
      .single();

    if (error) throw error;

    await propagateWinners(
      match.tournament_id,
      match.category_id
    );

    return data;
  }

  async function setParticipants(
    matchId,
    teamA,
    teamB
  ) {
    const {
      data: current,
      error: loadError
    } = await sb()
      .from("playoff_matches")
      .select(`
        id,
        team_a_id,
        team_b_id,
        score_a,
        score_b,
        winner_team_id,
        published
      `)
      .eq(
        "id",
        matchId
      )
      .single();

    if (loadError) {
      throw loadError;
    }

    if (!current) {
      return null;
    }

    if (
      current.published
    ) {
      return current;
    }

    const changed =
      current.team_a_id !==
        teamA ||
      current.team_b_id !==
        teamB;

    if (!changed) {
      return current;
    }

    const {
      data,
      error
    } = await sb()
      .from("playoff_matches")
      .update({
        team_a_id:
          teamA || null,
        team_b_id:
          teamB || null,
        score_a: null,
        score_b: null,
        winner_team_id: null
      })
      .eq(
        "id",
        matchId
      )
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function propagateWinners(
    tournamentId,
    categoryId
  ) {
    const matches =
      await getPlayoffs(
        tournamentId,
        categoryId
      );

    if (
      !matches ||
      matches.length === 0
    ) {
      return matches;
    }

    const quarters =
      matches.filter(
        m =>
          m.playoff_stage ===
          "cuartos"
      );

    const semis =
      matches.filter(
        m =>
          m.playoff_stage ===
          "semifinal"
      );

    const finals =
      matches.filter(
        m =>
          m.playoff_stage ===
          "final"
      );

    /*
     * Llave de 8:
     *
     * QF1 -> SF1
     * QF2 -> SF1
     * QF3 -> SF2
     * QF4 -> SF2
     */
    if (
      quarters.length === 4 &&
      semis.length >= 2
    ) {
      const qf1 =
        quarters.find(
          m =>
            m.seed_a === 1 &&
            m.seed_b === 8
        );

      const qf2 =
        quarters.find(
          m =>
            m.seed_a === 4 &&
            m.seed_b === 5
        );

      const qf3 =
        quarters.find(
          m =>
            m.seed_a === 2 &&
            m.seed_b === 7
        );

      const qf4 =
        quarters.find(
          m =>
            m.seed_a === 3 &&
            m.seed_b === 6
        );

      const sf1 =
        semis.find(
          m =>
            m.seed_a === 1 &&
            m.seed_b === 2
        );

      const sf2 =
        semis.find(
          m =>
            m.seed_a === 3 &&
            m.seed_b === 4
        );

      if (sf1) {
        await setParticipants(
          sf1.id,
          qf1?.winner_team_id ||
            null,
          qf2?.winner_team_id ||
            null
        );
      }

      if (sf2) {
        await setParticipants(
          sf2.id,
          qf3?.winner_team_id ||
            null,
          qf4?.winner_team_id ||
            null
        );
      }
    }

    /*
     * Llave de 4:
     * las dos semifinales alimentan la final.
     */
    if (
      semis.length >= 2 &&
      finals.length >= 1
    ) {
      const sf1 =
        semis.find(
          m =>
            m.seed_a === 1 &&
            m.seed_b === 4
        ) ||
        semis.find(
          m =>
            m.seed_a === 1 &&
            m.seed_b === 2
        );

      const sf2 =
        semis.find(
          m =>
            m.seed_a === 2 &&
            m.seed_b === 3
        ) ||
        semis.find(
          m =>
            m.seed_a === 3 &&
            m.seed_b === 4
        );

      const final =
        finals[0];

      await setParticipants(
        final.id,
        sf1?.winner_team_id ||
          null,
        sf2?.winner_team_id ||
          null
      );
    }

    return getPlayoffs(
      tournamentId,
      categoryId
    );
  }

  function stageLabel(
    stage
  ) {
    const labels = {
      cuartos: "Cuartos de final",
      semifinal: "Semifinal",
      final: "Final"
    };

    return (
      labels[stage] ||
      stage ||
      "Playoff"
    );
  }

  function renderPlayoffs(
    container,
    matches,
    teamMap = {}
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el contenedor de playoffs."
      );
    }

    container.innerHTML = "";

    if (
      !matches ||
      matches.length === 0
    ) {
      container.textContent =
        "No hay playoffs generados.";
      return container;
    }

    const groups = {};

    matches.forEach(match => {
      const stage =
        match.playoff_stage ||
        "playoff";

      if (!groups[stage]) {
        groups[stage] = [];
      }

      groups[stage].push(
        match
      );
    });

    Object.keys(groups)
      .sort((a, b) => {
        const order = {
          cuartos: 1,
          semifinal: 2,
          final: 3
        };

        return (
          (order[a] || 99) -
          (order[b] || 99)
        );
      })
      .forEach(stage => {
        const section =
          document.createElement(
            "section"
          );

        section.className =
          "gof-playoff-stage";

        const title =
          document.createElement(
            "h3"
          );

        title.textContent =
          stageLabel(stage);

        section.appendChild(
          title
        );

        groups[stage].forEach(
          match => {
            const card =
              document.createElement(
                "div"
              );

            card.className =
              "gof-playoff-card";

            const teamA =
              teamMap[
                match.team_a_id
              ] ||
              "Por definir";

            const teamB =
              teamMap[
                match.team_b_id
              ] ||
              "Por definir";

            const scoreA =
              match.score_a ??
              "—";

            const scoreB =
              match.score_b ??
              "—";

            card.innerHTML = `
              <div class="gof-playoff-meta">
                <span>Sembrado ${match.seed_a ?? "—"}</span>
                <span>vs</span>
                <span>Sembrado ${match.seed_b ?? "—"}</span>
              </div>

              <div class="gof-playoff-teams">
                <strong>${escapeHtml(teamA)}</strong>
                <strong>${escapeHtml(teamB)}</strong>
              </div>

              <div class="gof-playoff-score">
                <span>${scoreA}</span>
                <span>${scoreB}</span>
              </div>
            `;

            section.appendChild(
              card
            );
          }
        );

        container.appendChild(
          section
        );
      });

    return container;
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

  window.GOF =
    window.GOF || {};

  window.GOF.playoffs = {
    generatePlayoffs,
    getPlayoffs,
    savePlayoffResult,
    propagateWinners,
    calculateRanking,
    getQualifierCount,
    renderPlayoffs
  };
})(); 
