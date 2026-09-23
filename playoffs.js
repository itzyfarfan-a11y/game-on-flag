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
            qualifiers[3].id
