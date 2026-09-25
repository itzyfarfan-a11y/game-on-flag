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

  function stageLabel(stage) {
    const labels = {
      cuartos: "Cuartos de final",
      semifinal: "Semifinal",
      final: "Final"
    };

    return labels[stage] || stage || "Playoff";
  }

  function stageOrder(stage) {
    const order = {
      cuartos: 1,
      semifinal: 2,
      final: 3
    };

    return order[stage] || 99;
  }

  function formatLabel(formatCode) {
    const labels = {
      "8qf": "Cuartos → Semifinal → Final",
      "4sf": "Semifinal → Final",
      "2f": "Final directa"
    };

    return labels[formatCode] || "";
  }

  async function getTournament(tournamentId) {
    validateId(tournamentId, "Torneo no válido.");

    const league = requireLeague();

    const { data, error } = await sb()
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

  async function getTeams(tournamentId, categoryId) {
    const league = requireLeague();

    const { data, error } = await sb()
      .from("tournament_teams")
      .select(`
        id,
        tournament_id,
        team_id,
        category_id,
        is_active,
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
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId);

    if (error) throw error;

    return (data || [])
      .filter(row => {
        const active =
          row.is_active === undefined
            ? true
            : row.is_active === true;

        return (
          active &&
          row.teams?.league_id === league.id &&
          row.categories?.league_id === league.id
        );
      })
      .map(row => ({
        id: row.team_id,
        name: row.teams?.name || "SIN NOMBRE",
        logo_url: row.teams?.logo_url || null,
        tournament_team_id: row.id
      }));
  }

  async function getRegularMatches(tournamentId, categoryId) {
    const league = requireLeague();

    const { data, error } = await sb()
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
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId)
      .in("status", [
        "jugado",
        "incomparecencia"
      ]);

    if (error) throw error;

    return (data || []).filter(match => {
      return (
        (!match.categories ||
          match.categories.league_id === league.id) &&
        (!match.home_team ||
          match.home_team.league_id === league.id) &&
        (!match.away_team ||
          match.away_team.league_id === league.id)
      );
    });
  }

  /*
   * TABLA OFICIAL GAME ON FLAG
   *
   * 1. JG
   * 2. PA
   * 3. DIF
   * 4. PC menor
   * 5. Nombre
   *
   * No se utiliza sistema de 3 puntos.
   */
  function calculateRanking(teams, matches) {
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

      const home = table.get(match.home_team_id);
      const away = table.get(match.away_team_id);

      if (!home || !away) {
        return;
      }

      const excluded =
        match.is_makeup &&
        match.stats_exclude_team_id
          ? match.stats_exclude_team_id
          : null;

      const homeScore = Number(match.home_score);
      const awayScore = Number(match.away_score);

      if (excluded !== match.home_team_id) {
        home.jj++;
        home.pa += homeScore;
        home.pc += awayScore;

        if (homeScore > awayScore) {
          home.jg++;
        } else {
          home.jp++;
        }

        home.dif = home.pa - home.pc;
      }

      if (excluded !== match.away_team_id) {
        away.jj++;
        away.pa += awayScore;
        away.pc += homeScore;

        if (awayScore > homeScore) {
          away.jg++;
        } else {
          away.jp++;
        }

        away.dif = away.pa - away.pc;
      }
    });

    return Array.from(table.values()).sort(
      (a, b) =>
        b.jg - a.jg ||
        b.pa - a.pa ||
        b.dif - a.dif ||
        a.pc - b.pc ||
        String(a.name).localeCompare(
          String(b.name),
          "es-MX"
        )
    );
  }

  /*
   * Formatos:
   *
   * 2 equipos = Final directa
   * 4 equipos = Semifinal → Final
   * 8 equipos = Cuartos → Semifinal → Final
   */
  function normalizeFormat(formatCode, teamCount) {
    if (
      formatCode === "2f" ||
      formatCode === "4sf" ||
      formatCode === "8qf"
    ) {
      return formatCode;
    }

    if (teamCount >= 8) {
      return "8qf";
    }

    if (teamCount >= 4) {
      return "4sf";
    }

    return "2f";
  }

  function getQualifierCount(formatCode) {
    if (formatCode === "8qf") return 8;
    if (formatCode === "4sf") return 4;
    if (formatCode === "2f") return 2;
    return 0;
  }

  function buildBracket(qualifiers, formatCode) {
    const bracket = [];

    if (formatCode === "8qf") {
      const pairings = [
        [1, 8],
        [4, 5],
        [2, 7],
        [3, 6]
      ];

      pairings.forEach((pair, index) => {
        bracket.push({
          stage: "cuartos",
          match_order: index + 1,
          seed_a: pair[0],
          seed_b: pair[1],
          team_a_id: qualifiers[pair[0] - 1]?.id || null,
          team_b_id: qualifiers[pair[1] - 1]?.id || null,
          playoff_mode: "automatic",
          format_code: "8qf",
          manual_label: `Cuartos ${index + 1}`
        });
      });

      bracket.push(
        {
          stage: "semifinal",
          match_order: 5,
          seed_a: 1,
          seed_b: 2,
          team_a_id: null,
          team_b_id: null,
          playoff_mode: "automatic",
          format_code: "8qf",
          manual_label: "Semifinal 1"
        },
        {
          stage: "semifinal",
          match_order: 6,
          seed_a: 3,
          seed_b: 4,
          team_a_id: null,
          team_b_id: null,
          playoff_mode: "automatic",
          format_code: "8qf",
          manual_label: "Semifinal 2"
        },
        {
          stage: "final",
          match_order: 7,
          seed_a: 1,
          seed_b: 2,
          team_a_id: null,
          team_b_id: null,
          playoff_mode: "automatic",
          format_code: "8qf",
          manual_label: "Final"
        }
      );

      return bracket;
    }

    if (formatCode === "4sf") {
      bracket.push(
        {
          stage: "semifinal",
          match_order: 1,
          seed_a: 1,
          seed_b: 4,
          team_a_id: qualifiers[0]?.id || null,
          team_b_id: qualifiers[3]?.id || null,
          playoff_mode: "automatic",
          format_code: "4sf",
          manual_label: "Semifinal 1"
        },
        {
          stage: "semifinal",
          match_order: 2,
          seed_a: 2,
          seed_b: 3,
          team_a_id: qualifiers[1]?.id || null,
          team_b_id: qualifiers[2]?.id || null,
          playoff_mode: "automatic",
          format_code: "4sf",
          manual_label: "Semifinal 2"
        },
        {
          stage: "final",
          match_order: 3,
          seed_a: 1,
          seed_b: 2,
          team_a_id: null,
          team_b_id: null,
          playoff_mode: "automatic",
          format_code: "4sf",
          manual_label: "Final"
        }
      );

      return bracket;
    }

    if (formatCode === "2f") {
      bracket.push({
        stage: "final",
        match_order: 1,
        seed_a: 1,
        seed_b: 2,
        team_a_id: qualifiers[0]?.id || null,
        team_b_id: qualifiers[1]?.id || null,
        playoff_mode: "automatic",
        format_code: "2f",
        manual_label: "Final"
      });

      return bracket;
    }

    return bracket;
  }

  async function getExistingPlayoffs(
    tournamentId,
    categoryId
  ) {
    const { data, error } = await sb()
      .from("playoff_matches")
      .select(`
        id,
        tournament_id,
        category_id,
        stage,
        seed_a,
        seed_b,
        team_a_id,
        team_b_id,
        score_a,
        score_b,
        winner_team_id,
        match_order,
        published,
        match_date,
        match_time,
        field_name,
        playoff_mode,
        format_code,
        manual_label
      `)
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId)
      .order("match_order", {
        ascending: true
      });

    if (error) throw error;

    return data || [];
  }

  function hasPlayoffResults(matches) {
    return (matches || []).some(match =>
      match.winner_team_id ||
      match.score_a !== null ||
      match.score_b !== null ||
      match.published
    );
  }

  async function createPlayoffMatches(
    tournamentId,
    categoryId,
    bracket
  ) {
    if (!bracket || !bracket.length) {
      throw new Error(
        "No se pudo generar la llave de playoffs."
      );
    }

    const payload = bracket.map(item => ({
      tournament_id: tournamentId,
      category_id: categoryId,
      stage: item.stage,
      seed_a: item.seed_a,
      seed_b: item.seed_b,
      team_a_id: item.team_a_id,
      team_b_id: item.team_b_id,
      score_a: null,
      score_b: null,
      winner_team_id: null,
      match_order: item.match_order,
      published: false,
      playoff_mode: item.playoff_mode,
      format_code: item.format_code,
      manual_label: item.manual_label,
      match_date: null,
      match_time: null,
      field_name: null
    }));

    const { data, error } = await sb()
      .from("playoff_matches")
      .insert(payload)
      .select();

    if (error) throw error;

    return data || [];
  }

  async function generatePlayoffs({
    tournamentId,
    categoryId,
    formatCode = null
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
      await getTournament(tournamentId);

    if (tournament.status !== "activo") {
      throw new Error(
        "Los playoffs solo pueden generarse cuando el torneo está activo."
      );
    }

    const [
      teams,
      matches,
      existing
    ] = await Promise.all([
      getTeams(tournamentId, categoryId),
      getRegularMatches(
        tournamentId,
        categoryId
      ),
      getExistingPlayoffs(
        tournamentId,
        categoryId
      )
    ]);

    if (existing.length) {
      if (hasPlayoffResults(existing)) {
        throw new Error(
          "La llave de playoffs ya tiene resultados o publicaciones y no puede regenerarse."
        );
      }

      throw new Error(
        "Ya existe una llave de playoffs para esta categoría."
      );
    }

    if (teams.length < 2) {
      throw new Error(
        "Se necesitan al menos 2 equipos."
      );
    }

    const ranking =
      calculateRanking(
        teams,
        matches
      );

    const selectedFormat =
      normalizeFormat(
        formatCode,
        ranking.length
      );

    const qualifierCount =
      getQualifierCount(
        selectedFormat
      );

    if (ranking.length < qualifierCount) {
      throw new Error(
        `El formato ${formatLabel(selectedFormat)} requiere al menos ${qualifierCount} equipos.`
      );
    }

    const qualifiers =
      ranking.slice(
        0,
        qualifierCount
      );

    const bracket =
      buildBracket(
        qualifiers,
        selectedFormat
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

    const { data: match, error } =
      await sb()
        .from("playoff_matches")
        .select(`
          id,
          tournament_id,
          category_id,
          stage,
          team_a_id,
          team_b_id,
          score_a,
          score_b,
          winner_team_id,
          published
        `)
        .eq("id", playoffMatchId)
        .single();

    if (error) throw error;

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

    const a = Number(scoreA);
    const b = Number(scoreB);

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

    const { data, error: updateError } =
      await sb()
        .from("playoff_matches")
        .update({
          score_a: a,
          score_b: b,
          winner_team_id: winner
        })
        .eq("id", playoffMatchId)
        .select()
        .single();

    if (updateError) throw updateError;

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
    const { data: current, error } =
      await sb()
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
        .eq("id", matchId)
        .single();

    if (error) throw error;

    if (!current || current.published) {
      return current || null;
    }

    const changed =
      current.team_a_id !== (teamA || null) ||
      current.team_b_id !== (teamB || null);

    if (!changed) {
      return current;
    }

    const { data, error: updateError } =
      await sb()
        .from("playoff_matches")
        .update({
          team_a_id: teamA || null,
          team_b_id: teamB || null,
          score_a: null,
          score_b: null,
          winner_team_id: null
        })
        .eq("id", matchId)
        .select()
        .single();

    if (updateError) throw updateError;

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

    if (!matches.length) {
      return matches;
    }

    const quarters =
      matches
        .filter(m => m.stage === "cuartos")
        .sort(
          (a, b) =>
            a.match_order - b.match_order
        );

    const semis =
      matches
        .filter(m => m.stage === "semifinal")
        .sort(
          (a, b) =>
            a.match_order - b.match_order
        );

    const finals =
      matches
        .filter(m => m.stage === "final")
        .sort(
          (a, b) =>
            a.match_order - b.match_order
        );

    /*
     * 8 equipos:
     * QF1 + QF2 -> SF1
     * QF3 + QF4 -> SF2
     */
    if (
      quarters.length === 4 &&
      semis.length >= 2
    ) {
      await setParticipants(
        semis[0].id,
        quarters[0]?.winner_team_id || null,
        quarters[1]?.winner_team_id || null
      );

      await setParticipants(
        semis[1].id,
        quarters[2]?.winner_team_id || null,
        quarters[3]?.winner_team_id || null
      );
    }

    /*
     * 4 u 8 equipos:
     * semifinal 1 + semifinal 2 -> final
     */
    if (
      semis.length >= 2 &&
      finals.length
    ) {
      await setParticipants(
        finals[0].id,
        semis[0]?.winner_team_id || null,
        semis[1]?.winner_team_id || null
      );
    }

    return getPlayoffs(
      tournamentId,
      categoryId
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

    if (!matches || !matches.length) {
      container.textContent =
        "No hay playoffs generados.";
      return container;
    }

    const groups = {};

    matches.forEach(match => {
      const stage =
        match.stage || "playoff";

      if (!groups[stage]) {
        groups[stage] = [];
      }

      groups[stage].push(match);
    });

    Object.keys(groups)
      .sort(
        (a, b) =>
          stageOrder(a) - stageOrder(b)
      )
      .forEach(stage => {
        const section =
          document.createElement("section");

        section.className =
          "gof-playoff-stage";

        const title =
          document.createElement("h3");

        title.textContent =
          stageLabel(stage);

        section.appendChild(title);

        groups[stage]
          .sort(
            (a, b) =>
              a.match_order - b.match_order
          )
          .forEach(match => {
            const card =
              document.createElement("div");

            card.className =
              "gof-playoff-card";

            const teamA =
              teamMap[match.team_a_id] ||
              "Por definir";

            const teamB =
              teamMap[match.team_b_id] ||
              "Por definir";

            const scoreA =
              match.score_a ?? "—";

            const scoreB =
              match.score_b ?? "—";

            card.innerHTML = `
              <div class="gof-playoff-meta">
                <span>${escapeHtml(
                  match.manual_label ||
                  stageLabel(stage)
                )}</span>
                ${
                  match.format_code
                    ? `<span>${escapeHtml(
                        formatLabel(
                          match.format_code
                        )
                      )}</span>`
                    : ""
                }
              </div>

              <div class="gof-playoff-teams">
                <strong>${escapeHtml(
                  teamA
                )}</strong>
                <strong>${escapeHtml(
                  teamB
                )}</strong>
              </div>

              <div class="gof-playoff-score">
                <span>${scoreA}</span>
                <span>${scoreB}</span>
              </div>

              ${
                match.field_name ||
                match.match_date ||
                match.match_time
                  ? `
                    <div class="gof-playoff-meta">
                      <span>${
                        match.match_date || ""
                      }</span>
                      <span>${
                        match.match_time || ""
                      }</span>
                      <span>${
                        match.field_name || ""
                      }</span>
                    </div>
                  `
                  : ""
              }
            `;

            section.appendChild(card);
          });

        container.appendChild(section);
      });

    return container;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
    renderPlayoffs,
    buildBracket,
    formatLabel
  };
})();
