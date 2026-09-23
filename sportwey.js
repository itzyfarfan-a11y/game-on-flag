/* GAME ON FLAG — revisión Sportwey
   Módulo interno de revisión.
   No crea un botón público ni sustituye el sistema de roster.
*/
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

  function clean(value) {
    return String(value || "").trim();
  }

  async function reviewPlayer({
    tournamentId = null,
    categoryId = null,
    teamId = null,
    playerId = null,
    status = "pendiente",
    source = "sportwey",
    sourceUrl = null,
    notes = null
  }) {
    const league = requireLeague();

    if (!playerId) {
      throw new Error("Jugador no válido.");
    }

    const allowedStatuses = [
      "pendiente",
      "encontrado",
      "no_encontrado",
      "revisado"
    ];

    if (!allowedStatuses.includes(status)) {
      throw new Error("Estado de revisión no válido.");
    }

    const payload = {
      league_id: league.id,
      tournament_id: tournamentId || null,
      category_id: categoryId || null,
      team_id: teamId || null,
      player_id: playerId,
      status,
      source: clean(source) || "sportwey",
      source_url: clean(sourceUrl) || null,
      notes: clean(notes) || null
    };

    const { data, error } = await sb()
      .from("sportwey_review_log")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function updateReview(reviewId, values) {
    if (!reviewId) {
      throw new Error("Revisión no válida.");
    }

    requireLeague();

    const payload = {};

    if (Object.prototype.hasOwnProperty.call(values || {}, "status")) {
      const status = clean(values.status);

      if (
        ![
          "pendiente",
          "encontrado",
          "no_encontrado",
          "revisado"
        ].includes(status)
      ) {
        throw new Error("Estado de revisión no válido.");
      }

      payload.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(values || {}, "source")) {
      payload.source = clean(values.source) || "sportwey";
    }

    if (
      Object.prototype.hasOwnProperty.call(
        values || {},
        "source_url"
      )
    ) {
      payload.source_url =
        clean(values.source_url) || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        values || {},
        "notes"
      )
    ) {
      payload.notes =
        clean(values.notes) || null;
    }

    if (!Object.keys(payload).length) {
      throw new Error("No hay cambios para guardar.");
    }

    const { data, error } = await sb()
      .from("sportwey_review_log")
      .update(payload)
      .eq("id", reviewId)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function listPlayerReviews(playerId) {
    if (!playerId) {
      throw new Error("Jugador no válido.");
    }

    const league = requireLeague();

    const { data, error } = await sb()
      .from("sportwey_review_log")
      .select(`
        id,
        league_id,
        tournament_id,
        category_id,
        team_id,
        player_id,
        status,
        source,
        source_url,
        notes,
        reviewed_by,
        reviewed_at,
        created_at
      `)
      .eq("league_id", league.id)
      .eq("player_id", playerId)
      .order("created_at", {
        ascending: false
      });

    if (error) throw error;

    return data || [];
  }

  async function listTeamReviews(teamId, tournamentId = null) {
    if (!teamId) {
      throw new Error("Equipo no válido.");
    }

    const league = requireLeague();

    let query = sb()
      .from("sportwey_review_log")
      .select(`
        id,
        league_id,
        tournament_id,
        category_id,
        team_id,
        player_id,
        status,
        source,
        source_url,
        notes,
        reviewed_by,
        reviewed_at,
        created_at,
        players (
          id,
          full_name,
          photo_url,
          jersey_number
        )
      `)
      .eq("league_id", league.id)
      .eq("team_id", teamId)
      .order("created_at", {
        ascending: false
      });

    if (tournamentId) {
      query = query.eq(
        "tournament_id",
        tournamentId
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  }

  async function getReviewSummary(teamId, tournamentId = null) {
    const reviews =
      await listTeamReviews(
        teamId,
        tournamentId
      );

    const summary = {
      total: reviews.length,
      pendiente: 0,
      encontrado: 0,
      no_encontrado: 0,
      revisado: 0
    };

    reviews.forEach(review => {
      if (
        Object.prototype.hasOwnProperty.call(
          summary,
          review.status
        )
      ) {
        summary[review.status]++;
      }
    });

    return summary;
  }

  window.GOF = window.GOF || {};

  window.GOF.sportwey = {
    reviewPlayer,
    updateReview,
    listPlayerReviews,
    listTeamReviews,
    getReviewSummary
  };
})();
