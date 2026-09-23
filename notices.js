/* GAME ON FLAG — Avisos */
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
        "Solo un administrador puede administrar avisos."
      );
    }

    return true;
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function normalizeStatus(status) {
    return status === "publicado"
      ? "publicado"
      : "borrador";
  }

  async function listNotices({
    tournamentId = null,
    status = null
  } = {}) {
    const league = requireLeague();

    let query = sb()
      .from("nffl_notices")
      .select(`
        id,
        league_id,
        tournament_id,
        title,
        message,
        status,
        published_at,
        created_at,
        created_by,
        tournaments (
          id,
          name,
          league_id
        )
      `)
      .eq(
        "league_id",
        league.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (tournamentId) {
      query = query.eq(
        "tournament_id",
        tournamentId
      );
    }

    if (status) {
      query = query.eq(
        "status",
        normalizeStatus(status)
      );
    }

    const {
      data,
      error
    } = await query;

    if (error) throw error;

    return (data || []).filter(
      notice =>
        notice.league_id ===
        league.id &&
        (
          !notice.tournaments ||
          notice.tournaments.league_id ===
            league.id
        )
    );
  }

  async function getNotice(
    noticeId
  ) {
    const league = requireLeague();

    requireId(
      noticeId,
      "Aviso no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("nffl_notices")
      .select(`
        id,
        league_id,
        tournament_id,
        title,
        message,
        status,
        published_at,
        created_at,
        created_by,
        tournaments (
          id,
          name,
          league_id
        )
      `)
      .eq(
        "id",
        noticeId
      )
      .eq(
        "league_id",
        league.id
      )
      .single();

    if (error) throw error;

    return data;
  }

  async function createNotice({
    tournamentId = null,
    title,
    message,
    status = "borrador"
  }) {
    await requireAdmin();

    const league = requireLeague();

    const cleanTitle =
      cleanText(title);

   
