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

  function requireId(id, label) {
    if (!id) {
      throw new Error((label || "Registro") + " no válido.");
    }

    return id;
  }

  function normalizeMatch(match) {
    if (!match) {
      return null;
    }

    return {
      ...match,
      home_team: match.home_team || null,
      away_team: match.away_team || null,
      categories: match.categories || null
    };
  }

  const MATCH_SELECT = `
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
  `;

  async function listMatches(tournamentId, categoryId) {
    requireId(tournamentId, "Torneo");

    const league = requireLeague();

    let query = sb()
      .from("matches")
      .select(MATCH_SELECT)
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
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || [])
      .filter(function (match) {
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
      })
      .map(normalizeMatch);
  }

  async function getMatch(matchId) {
    requireId(matchId, "Partido");

    const league = requireLeague();

    const { data, error } = await sb()
      .from("matches")
      .select(MATCH_SELECT)
      .eq("id", matchId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const homeOk =
      !data.home_team ||
      data.home_team.league_id === league.id;

    const awayOk =
      !data.away_team ||
      data.away_team.league_id === league.id;

    const categoryOk =
      !data.categories ||
      data.categories.league_id === league.id;

    if (!homeOk || !awayOk || !categoryOk) {
      throw new Error(
        "El partido no pertenece a la liga activa."
      );
    }

    return normalizeMatch(data);
  }

  async function createMatch(options) {
    const input = options || {};

    const tournamentId = input.tournamentId;
    const categoryId = input.categoryId;
    const homeTeamId = input.homeTeamId;
    const awayTeamId = input.awayTeamId;

    requireId(tournamentId, "Torneo");
    requireId(categoryId, "Categoría");
    requireId(homeTeamId, "Equipo local");
    requireId(awayTeamId, "Equipo visitante");

    if (homeTeamId === awayTeamId) {
      throw new Error(
        "Un equipo no puede enfrentarse contra sí mismo."
      );
    }

    const league = requireLeague();

    const round = Number(input.roundNumber);

    if (
      !Number.isInteger(round) ||
      round < 1 ||
      round > 7
    ) {
      throw new Error(
        "La jornada debe estar entre 1 y 7."
      );
    }

    const row = {
      tournament_id: tournamentId,
      category_id: categoryId,
      round_number: round,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      status: "programado",
      published: false,
      is_makeup: Boolean(input.isMakeup),
      stats_exclude_team_id:
        input.statsExcludeTeamId || null,
      replacement_note:
        input.replacementNote
          ? String(input.replacementNote).trim()
          : null,
      referee_fee_due:
        Boolean(input.refereeFeeDue)
    };

    if (input.matchDate) {
      row.match_date = input.matchDate;
    }

    if (input.matchTime) {
      row.match_time = input.matchTime;
    }

    if (input.fieldName) {
      row.field_name = String(input.fieldName).trim();
    }

    const { data, error } = await sb()
      .from("matches")
      .insert(row)
      .select(MATCH_SELECT)
      .single();

    if (error) {
      throw error;
    }

    if (
      !data ||
      (data.categories &&
        data.categories.league_id !== league.id)
    ) {
      throw new Error(
        "El enfrentamiento no pertenece a la liga activa."
      );
    }

    return normalizeMatch(data);
  }

  async function updateMatch(matchId, changes) {
    requireId(matchId, "Partido");

    const current = await getMatch(matchId);

    if (!current) {
      throw new Error("El partido no existe.");
    }

    const input = changes || {};
    const update = {};

    const allowedFields = [
      "category_id",
      "round_number",
      "home_team_id",
      "away_team_id",
      "home_score",
      "away_score",
      "status",
      "absent_team_id",
      "referee_fee_due",
      "published",
      "is_makeup",
      "stats_exclude_team_id",
      "replacement_note"
    ];

    allowedFields.forEach(function (field) {
      if (
        Object.prototype.hasOwnProperty.call(
          input,
          field
        )
      ) {
        update[field] = input[field];
      }
    });

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "home_team_id"
      ) &&
      input.home_team_id === current.away_team_id
    ) {
      throw new Error(
        "Un equipo no puede enfrentarse contra sí mismo."
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "away_team_id"
      ) &&
      input.away_team_id === current.home_team_id
    ) {
      throw new Error(
        "Un equipo no puede enfrentarse contra sí mismo."
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "round_number"
      )
    ) {
      const round = Number(input.round_number);

      if (
        !Number.isInteger(round) ||
        round < 1 ||
        round > 7
      ) {
        throw new Error(
          "La jornada debe estar entre 1 y 7."
        );
      }

      update.round_number = round;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "status"
      )
    ) {
      const allowedStatuses = [
        "programado",
        "jugado",
        "cancelado",
        "incomparecencia"
      ];

      if (
        !allowedStatuses.includes(
          input.status
        )
      ) {
        throw new Error(
          "Estado de partido no válido."
        );
      }
    }

    if (!Object.keys(update).length) {
      return current;
    }

    const { data, error } = await sb()
      .from("matches")
      .update(update)
      .eq("id", matchId)
      .select(MATCH_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return normalizeMatch(data);
  }

  async function updateMatchSchedule(
    matchId,
    schedule
  ) {
    requireId(matchId, "Partido");

    const input = schedule || {};

    if (!input.matchDate) {
      throw new Error(
        "La fecha del partido es obligatoria."
      );
    }

    if (!input.matchTime) {
      throw new Error(
        "La hora del partido es obligatoria."
      );
    }

    if (!input.fieldName) {
      throw new Error(
        "El campo del partido es obligatorio."
      );
    }

    const params = {
      p_match_id: matchId,
      p_match_date: input.matchDate,
      p_match_time: input.matchTime,
      p_field_name: input.fieldName,
      p_force: Boolean(input.force),
      p_override_note:
        input.overrideNote
          ? String(input.overrideNote).trim()
          : null
    };

    const { data, error } = await sb().rpc(
      "admin_update_match_schedule",
      params
    );

    if (error) {
      throw error;
    }

    return data;
  }

  async function deleteMatch(matchId) {
    requireId(matchId, "Partido");

    const current = await getMatch(matchId);

    if (!current) {
      throw new Error("El partido no existe.");
    }

    const { error } = await sb()
      .from("matches")
      .delete()
      .eq("id", matchId);

    if (error) {
      throw error;
    }

    return true;
  }

  async function setPublished(
    matchId,
    published
  ) {
    requireId(matchId, "Partido");

    const current = await getMatch(matchId);

    if (!current) {
      throw new Error("El partido no existe.");
    }

    const { data, error } = await sb()
      .from("matches")
      .update({
        published: Boolean(published)
      })
      .eq("id", matchId)
      .select(MATCH_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return normalizeMatch(data);
  }

  window.GOF = window.GOF || {};

  window.GOF.matches = {
    listMatches,
    getMatch,
    createMatch,
    updateMatch,
    updateMatchSchedule,
    deleteMatch,
    setPublished
  };
})();
