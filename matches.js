/* GAME ON FLAG — Enfrentamientos */
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

  async function listMatches(tournamentId, categoryId) {
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
        referee_fee_due,
        published,
        created_at,
        is_makeup,
        stats_exclude_team_id,
        replacement_note,
        schedule_manual_override,
        schedule_override_note,
        schedule_override_at,
        schedule_generated_at,
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

      return categoryOk && homeOk && awayOk;
    });
  }

  async function getMatch(matchId) {
    if (!matchId) {
      throw new Error("Partido no válido.");
    }

    const league = requireLeague();

    const { data, error } = await sb()
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
        referee_fee_due,
        published,
        created_at,
        is_makeup,
        stats_exclude_team_id,
        replacement_note,
        schedule_manual_override,
        schedule_override_note,
        schedule_override_at,
        schedule_generated_at,
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
        )
      `)
      .eq("id", matchId)
      .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    const validHome =
      !data.home_team ||
      data.home_team.league_id === league.id;

    const validAway =
      !data.away_team ||
      data.away_team.league_id === league.id;

    if (!validHome || !validAway) {
      throw new Error(
        "El partido no pertenece a la liga activa."
      );
    }

    return data;
  }

  async function createMatch({
    tournamentId,
    categoryId,
    roundNumber,
    homeTeamId,
    awayTeamId,
    isMakeup = false,
    statsExcludeTeamId = null,
    replacementNote = null
  }) {
    if (
      !tournamentId ||
      !categoryId ||
      !homeTeamId ||
      !awayTeamId
    ) {
      throw new Error(
        "Faltan datos para crear el enfrentamiento."
      );
    }

    if (homeTeamId === awayTeamId) {
      throw new Error(
        "Un equipo no puede enfrentarse contra sí mismo."
      );
    }

    const league = requireLeague();

    const round = Number(roundNumber);

    if (!Number.isInteger(round) || round < 1) {
      throw new Error(
        "La
