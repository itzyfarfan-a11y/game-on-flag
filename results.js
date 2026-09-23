/* GAME ON FLAG — Resultados */
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

  function validateScore(score, label) {
    if (
      score === null ||
      score === undefined ||
      score === ""
    ) {
      throw new Error(
        `Falta el marcador de ${label}.`
      );
    }

    const value = Number(score);

    if (
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new Error(
        `El marcador de ${label} no es válido.`
      );
    }

    return value;
  }

  async function getMatch(matchId) {
    if (!matchId) {
      throw new Error("Partido no válido.");
    }

    requireLeague();

    if (
      !window.GOF.matches ||
      typeof window.GOF.matches.getMatch !== "function"
    ) {
      throw new Error(
        "El módulo de enfrentamientos no está cargado."
      );
    }

    return window.GOF.matches.getMatch(
      matchId
    );
  }

  async function savePlayedResult({
    matchId,
    homeScore,
    awayScore
  }) {
    if (!matchId) {
      throw new Error("Partido no válido.");
    }

    const match =
      await getMatch(matchId);

    if (!match) {
      throw new Error(
        "No se encontró el partido."
      );
    }

    if (
      !["programado", "borrador"].includes(
        match.status
      )
    ) {
      throw new Error(
        "Este partido no está disponible para capturar resultado."
      );
    }

    const home = validateScore(
      homeScore,
      "equipo local"
    );

    const away = validateScore(
      awayScore,
      "equipo visitante"
    );

    const { data, error } = await sb()
      .from("matches")
      .update({
        home_score: home,
        away_score: away,
        status: "jugado",
        absent_team_id: null
      })
      .eq("id", matchId)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function saveForfeitResult({
    matchId,
    absentTeamId
  }) {
    if (!matchId || !absentTeamId) {
      throw new Error(
        "Faltan datos para registrar la incomparecencia."
      );
    }

    const match =
      await getMatch(matchId);

    if (!match) {
      throw new Error(
        "No se encontró el partido."
      );
    }

    if (
      !["programado", "borrador"].includes(
        match.status
      )
    ) {
      throw new Error(
        "Este partido no está disponible para registrar incomparecencia."
      );
    }

    if (
      absentTeamId !== match.home_team_id &&
      absentTeamId !== match.away_team_id
    ) {
      throw new Error(
        "El equipo ausente debe ser uno de los equipos del partido."
      );
    }

    const homeScore =
      absentTeamId === match.home_team_id
        ? 0
        : 18;

    const awayScore =
      absentTeamId === match.away_team_id
        ? 0
        : 18;

    const { data, error } = await sb()
      .from("matches")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: "incomparecencia",
        absent_team_id: absentTeamId
      })
      .eq("id", matchId)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function cancelResult(matchId) {
    if (!matchId) {
      throw new Error("Partido no válido.");
    }

    const match =
      await getMatch(matchId);

    if (!match) {
      throw new Error(
        "No se encontró el partido."
      );
    }

    const { data, error } = await sb()
      .from("matches")
      .update({
        home_score: null,
        away_score: null,
        absent_team_id: null,
        status: "programado"
      })
      .eq("id", matchId)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function listResults(
    tournamentId,
    categoryId = null
  ) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    const league = requireLeague();

    let query = sb()
      .from("matches")
      .select(`
        id,
        tournament_id,
        category_id,
        round_number,
        match_date,
        match_time,
        field_name,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status,
        absent_team_id,
        published,
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
      .in("status", [
        "jugado",
        "incomparecencia"
      ])
      .order("round_number", {
        ascending: true
      })
      .order("match_date", {
        ascending: true,
        nullsFirst: true
      })
      .order("match_time", {
        ascending: true,
        nullsFirst: true
      });

    if (categoryId) {
      query = query.eq(
        "category_id",
        categoryId
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).filter(match => {
      const categoryOk =
        !match.categories ||
        match.categories.league_id === league.id;

      const homeOk =
        !match.home_team ||
        match.home_team.league_id === league.id;

      const awayOk =
        !match.away_team ||
        match.away_team.league_id === league.id;

      return (
        categoryOk &&
        homeOk &&
        awayOk
      );
    });
  }

  window.GOF = window.GOF || {};

  window.GOF.results = {
    savePlayedResult,
    saveForfeitResult,
    cancelResult,
    listResults
  };
})();
