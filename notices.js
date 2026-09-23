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

    /*
      La autorización real permanece en Supabase.
      No dependemos de una función inexistente en auth.js.
    */
    const { data, error } =
      await sb().rpc("is_admin");

    if (error) {
      throw error;
    }

    if (data !== true) {
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

  function normalizeNoticePayload({
    tournamentId = null,
    title,
    message,
    status = "borrador"
  }) {
    const cleanTitle =
      cleanText(title);

    const cleanMessage =
      cleanText(message);

    if (!cleanTitle) {
      throw new Error(
        "El título del aviso es obligatorio."
      );
    }

    if (!cleanMessage) {
      throw new Error(
        "El mensaje del aviso es obligatorio."
      );
    }

    if (cleanTitle.length > 200) {
      throw new Error(
        "El título no puede superar 200 caracteres."
      );
    }

    if (cleanMessage.length > 10000) {
      throw new Error(
        "El mensaje no puede superar 10,000 caracteres."
      );
    }

    return {
      tournamentId:
        tournamentId || null,
      title:
        cleanTitle,
      message:
        cleanMessage,
      status:
        normalizeStatus(status)
    };
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

    if (error) {
      throw error;
    }

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

    if (error) {
      throw error;
    }

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

    const payload =
      normalizeNoticePayload({
        tournamentId,
        title,
        message,
        status
      });

    /*
      Si se publica directamente, registramos
      la fecha de publicación.
    */
    const publishedAt =
      payload.status === "publicado"
        ? new Date().toISOString()
        : null;

    const {
      data,
      error
    } = await sb()
      .from("nffl_notices")
      .insert({
        league_id:
          league.id,
        tournament_id:
          payload.tournamentId,
        title:
          payload.title,
        message:
          payload.message,
        status:
          payload.status,
        published_at:
          publishedAt
      })
      .select(`
        id,
        league_id,
        tournament_id,
        title,
        message,
        status,
        published_at,
        created_at,
        created_by
      `)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function updateNotice({
    noticeId,
    tournamentId = null,
    title,
    message,
    status = "borrador"
  }) {
    await requireAdmin();

    const league = requireLeague();

    requireId(
      noticeId,
      "Aviso no válido."
    );

    const payload =
      normalizeNoticePayload({
        tournamentId,
        title,
        message,
        status
      });

    /*
      Verificamos que el aviso pertenezca
      a la liga activa antes de modificarlo.
    */
    const existing =
      await getNotice(noticeId);

    if (
      !existing ||
      existing.league_id !== league.id
    ) {
      throw new Error(
        "El aviso no pertenece a la liga activa."
      );
    }

    let publishedAt =
      existing.published_at || null;

    if (
      payload.status === "publicado" &&
      !publishedAt
    ) {
      publishedAt =
        new Date().toISOString();
    }

    if (
      payload.status !== "publicado"
    ) {
      publishedAt = null;
    }

    const {
      data,
      error
    } = await sb()
      .from("nffl_notices")
      .update({
        tournament_id:
          payload.tournamentId,
        title:
          payload.title,
        message:
          payload.message,
        status:
          payload.status,
        published_at:
          publishedAt
      })
      .eq(
        "id",
        noticeId
      )
      .eq(
        "league_id",
        league.id
      )
      .select(`
        id,
        league_id,
        tournament_id,
        title,
        message,
        status,
        published_at,
        created_at,
        created_by
      `)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function publishNotice(
    noticeId
  ) {
    await requireAdmin();

    const league =
      requireLeague();

    requireId(
      noticeId,
      "Aviso no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("nffl_notices")
      .update({
        status:
          "publicado",
        published_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        noticeId
      )
      .eq(
        "league_id",
        league.id
      )
      .select(`
        id,
        league_id,
        tournament_id,
        title,
        message,
        status,
        published_at,
        created_at,
        created_by
      `)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function unpublishNotice(
    noticeId
  ) {
    await requireAdmin();

    const league =
      requireLeague();

    requireId(
      noticeId,
      "Aviso no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("nffl_notices")
      .update({
        status:
          "borrador",
        published_at:
          null
      })
      .eq(
        "id",
        noticeId
      )
      .eq(
        "league_id",
        league.id
      )
      .select(`
        id,
        league_id,
        tournament_id,
        title,
        message,
        status,
        published_at,
        created_at,
        created_by
      `)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function deleteNotice(
    noticeId
  ) {
    await requireAdmin();

    const league =
      requireLeague();

    requireId(
      noticeId,
      "Aviso no válido."
    );

    const {
      data: existing,
      error: findError
    } = await sb()
      .from("nffl_notices")
      .select("id")
      .eq(
        "id",
        noticeId
      )
      .eq(
        "league_id",
        league.id
      )
      .single();

    if (findError) {
      throw findError;
    }

    if (!existing) {
      throw new Error(
        "Aviso no encontrado."
      );
    }

    const {
      error
    } = await sb()
      .from("nffl_notices")
      .delete()
      .eq(
        "id",
        noticeId
      )
      .eq(
        "league_id",
        league.id
      );

    if (error) {
      throw error;
    }

    return {
      success: true,
      noticeId
    };
  }

  window.GOF =
    window.GOF || {};

  window.GOF.notices = {
    listNotices,
    getNotice,
    createNotice,
    updateNotice,
    publishNotice,
    unpublishNotice,
    deleteNotice
  };
})();
