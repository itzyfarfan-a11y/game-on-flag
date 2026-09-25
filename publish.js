/* GAME ON FLAG — Publicación */
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

  function requireId(id, message) {
    if (!id) {
      throw new Error(message);
    }
    return id;
  }

  async function requireAdmin() {
    requireLeague();

    if (
      !window.GOF.auth ||
      typeof window.GOF.auth.isAdmin !== "function"
    ) {
      throw new Error(
        "El módulo de autenticación no está cargado."
      );
    }

    const allowed =
      await window.GOF.auth.isAdmin();

    if (!allowed) {
      throw new Error(
        "Solo un administrador puede publicar información."
      );
    }

    return true;
  }

  async function getTournament(tournamentId) {
    const league = requireLeague();

    requireId(
      tournamentId,
      "Torneo no válido."
    );

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
        start_date,
        end_date
      `)
      .eq("id", tournamentId)
      .eq("league_id", league.id)
      .single();

    if (error) throw error;

    return data;
  }

  async function getPublishedMatches(tournamentId) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

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
        match_date,
        match_time,
        field_name,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status,
        published,
        is_makeup,
        categories (
          id,
          name,
          league_id
        ),
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
      .eq("tournament_id", tournamentId)
      .eq("published", true)
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

    if (error) throw error;

    return (data || []).filter(
      match =>
        (
          !match.categories ||
          match.categories.league_id === league.id
        ) &&
        (
          !match.home_team ||
          match.home_team.league_id === league.id
        ) &&
        (
          !match.away_team ||
          match.away_team.league_id === league.id
        )
    );
  }

  async function getUnpublishedMatches(tournamentId) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

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
        match_date,
        match_time,
        field_name,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status,
        published,
        categories (
          id,
          name,
          league_id
        ),
        home_team:teams!matches_home_team_id_fkey (
          id,
          name,
          league_id
        ),
        away_team:teams!matches_away_team_id_fkey (
          id,
          name,
          league_id
        )
      `)
      .eq("tournament_id", tournamentId)
      .eq("published", false)
      .order("round_number", {
        ascending: true
      });

    if (error) throw error;

    return (data || []).filter(
      match =>
        (
          !match.categories ||
          match.categories.league_id === league.id
        ) &&
        (
          !match.home_team ||
          match.home_team.league_id === league.id
        ) &&
        (
          !match.away_team ||
          match.away_team.league_id === league.id
        )
    );
  }

  async function getPublishedPlayoffs(tournamentId) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

    const league = requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("playoff_matches")
      .select(`
        id,
        tournament_id,
        category_id,
        stage,
        match_order,
        format_code,
        manual_label,
        seed_a,
        seed_b,
        team_a_id,
        team_b_id,
        score_a,
        score_b,
        winner_team_id,
        published,
        match_date,
        match_time,
        field_name,
        team_a:teams!playoff_matches_team_a_id_fkey (
          id,
          name,
          logo_url,
          league_id
        ),
        team_b:teams!playoff_matches_team_b_id_fkey (
          id,
          name,
          logo_url,
          league_id
        )
      `)
      .eq("tournament_id", tournamentId)
      .eq("published", true)
      .order("match_order", {
        ascending: true
      });

    if (error) throw error;

    return (data || []).filter(
      match =>
        (
          !match.team_a ||
          match.team_a.league_id === league.id
        ) &&
        (
          !match.team_b ||
          match.team_b.league_id === league.id
        )
    );
  }

  async function publishMatch(matchId) {
    await requireAdmin();

    requireId(
      matchId,
      "Partido no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("matches")
      .update({
        published: true
      })
      .eq("id", matchId)
      .select(`
        id,
        tournament_id,
        published
      `)
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "No se pudo publicar el partido."
      );
    }

    return data;
  }

  async function unpublishMatch(matchId) {
    await requireAdmin();

    requireId(
      matchId,
      "Partido no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("matches")
      .update({
        published: false
      })
      .eq("id", matchId)
      .select(`
        id,
        tournament_id,
        published
      `)
      .single();

    if (error) throw error;

    return data;
  }

  async function publishPlayoff(playoffMatchId) {
    await requireAdmin();

    requireId(
      playoffMatchId,
      "Partido de playoffs no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("playoff_matches")
      .update({
        published: true
      })
      .eq("id", playoffMatchId)
      .select(`
        id,
        tournament_id,
        published
      `)
      .single();

    if (error) throw error;

    return data;
  }

  async function unpublishPlayoff(playoffMatchId) {
    await requireAdmin();

    requireId(
      playoffMatchId,
      "Partido de playoffs no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("playoff_matches")
      .update({
        published: false
      })
      .eq("id", playoffMatchId)
      .select(`
        id,
        tournament_id,
        published
      `)
      .single();

    if (error) throw error;

    return data;
  }

  async function getPublicationState(tournamentId) {
    await requireAdmin();

    const [
      tournament,
      publishedMatches,
      unpublishedMatches,
      publishedPlayoffs
    ] = await Promise.all([
      getTournament(tournamentId),
      getPublishedMatches(tournamentId),
      getUnpublishedMatches(tournamentId),
      getPublishedPlayoffs(tournamentId)
    ]);

    return {
      tournament,
      publishedMatches,
      unpublishedMatches,
      publishedPlayoffs,
      publishedMatchCount:
        publishedMatches.length,
      unpublishedMatchCount:
        unpublishedMatches.length,
      publishedPlayoffCount:
        publishedPlayoffs.length
    };
  }

  async function publishCompletedResults(tournamentId) {
    await requireAdmin();

    requireId(
      tournamentId,
      "Torneo no válido."
    );

    const league = requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("matches")
      .update({
        published: true
      })
      .eq("tournament_id", tournamentId)
      .eq("published", false)
      .in("status", [
        "jugado",
        "incomparecencia"
      ])
      .select(`
        id,
        tournament_id,
        published,
        categories (
          league_id
        )
      `);

    if (error) throw error;

    return (data || []).filter(
      match =>
        !match.categories ||
        match.categories.league_id === league.id
    );
  }

  async function unpublishAllMatches(tournamentId) {
    await requireAdmin();

    requireId(
      tournamentId,
      "Torneo no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("matches")
      .update({
        published: false
      })
      .eq("tournament_id", tournamentId)
      .eq("published", true)
      .select(`
        id,
        tournament_id,
        published
      `);

    if (error) throw error;

    return data || [];
  }

  function getPublicationSummary(state) {
    const data = state || {};

    const published =
      Number(
        data.publishedMatchCount || 0
      );

    const pending =
      Number(
        data.unpublishedMatchCount || 0
      );

    const playoffs =
      Number(
        data.publishedPlayoffCount || 0
      );

    return {
      published,
      pending,
      playoffs,
      total:
        published + pending,
      ready:
        pending === 0
    };
  }

  function renderPublicationState(
    container,
    state
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el contenedor de publicación."
      );
    }

    const summary =
      getPublicationSummary(state);

    container.innerHTML = `
      <div class="gof-publication-card">
        <span>
          Partidos publicados
        </span>

        <strong>
          ${summary.published}
        </strong>
      </div>

      <div class="gof-publication-card">
        <span>
          Partidos pendientes
        </span>

        <strong>
          ${summary.pending}
        </strong>
      </div>

      <div class="gof-publication-card">
        <span>
          Playoffs publicados
        </span>

        <strong>
          ${summary.playoffs}
        </strong>
      </div>

      <div class="gof-publication-status"
           data-ready="${summary.ready}">
        ${
          summary.ready
            ? "Calendario completamente publicado"
            : "Hay partidos pendientes de publicación"
        }
      </div>
    `;

    return container;
  }

  window.GOF =
    window.GOF || {};

  window.GOF.publish = {
    getTournament,
    getPublishedMatches,
    getUnpublishedMatches,
    getPublishedPlayoffs,
    publishMatch,
    unpublishMatch,
    publishPlayoff,
    unpublishPlayoff,
    getPublicationState,
    publishCompletedResults,
    unpublishAllMatches,
    getPublicationSummary,
    renderPublicationState
  };
})(); 
