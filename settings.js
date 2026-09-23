/* GAME ON FLAG — Configuración */
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
        "Solo un administrador puede modificar la configuración."
      );
    }

    return true;
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function normalizeSlug(value) {
    return cleanText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .replace(
        /-{2,}/g,
        "-"
      );
  }

  async function getLeague() {
    const league = requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("leagues")
      .select(`
        id,
        name,
        slug,
        logo_url,
        description,
        owner_id,
        active,
        created_at
      `)
      .eq(
        "id",
        league.id
      )
      .single();

    if (error) throw error;

    return data;
  }

  async function updateLeague({
    name,
    slug,
    logoUrl = null,
    description = null
  }) {
    await requireAdmin();

    const league =
      requireLeague();

    const cleanName =
      cleanText(name);

    if (!cleanName) {
      throw new Error(
        "El nombre de la liga es obligatorio."
      );
    }

    const cleanSlug =
      normalizeSlug(
        slug || cleanName
      );

    if (!cleanSlug) {
      throw new Error(
        "El identificador público de la liga no es válido."
      );
    }

    const {
      data,
      error
    } = await sb()
      .from("leagues")
      .update({
        name:
          cleanName,
        slug:
          cleanSlug,
        logo_url:
          cleanText(logoUrl) ||
          null,
        description:
          cleanText(
            description
          ) || null
      })
      .eq(
        "id",
        league.id
      )
      .select()
      .single();

    if (error) throw error;

    /*
     * Mantener sincronizado el contexto local
     * después de guardar.
     */
    if (
      window.GOF.context
    ) {
      window.GOF.context.activeLeague =
        data;
    }

    return data;
  }

  async function getLeagueMembers() {
    const league =
      requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("league_members")
      .select(`
        id,
        league_id,
        user_id,
        role,
        active,
        is_current,
        created_at,
        profiles (
          id,
          full_name,
          photo_url,
          role
        )
      `)
      .eq(
        "league_id",
        league.id
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

    if (error) throw error;

    return data || [];
  }

  async function updateMemberRole({
    memberId,
    role
  }) {
    await requireAdmin();

    requireId(
      memberId,
      "Miembro no válido."
    );

    if (
      ![
        "owner",
        "admin"
      ].includes(role)
    ) {
      throw new Error(
        "El rol de liga no es válido."
      );
    }

    const league =
      requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("league_members")
      .update({
        role
      })
      .eq(
        "id",
        memberId
      )
      .eq(
        "league_id",
        league.id
      )
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function deactivateMember(
    memberId
  ) {
    await requireAdmin();

    requireId(
      memberId,
      "Miembro no válido."
    );

    const league =
      requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("league_members")
      .update({
        active: false,
        is_current: false
      })
      .eq(
        "id",
        memberId
      )
      .eq(
        "league_id",
        league.id
      )
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function reactivateMember(
    memberId
  ) {
    await requireAdmin();

    requireId(
      memberId,
      "Miembro no válido."
    );

    const league =
      requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("league_members")
      .update({
        active: true
      })
      .eq(
        "id",
        memberId
      )
      .eq(
        "league_id",
        league.id
      )
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function generateAccessCode() {
    await requireAdmin();

    const league =
      requireLeague();

    const {
      data,
      error
    } = await sb()
      .rpc(
        "generate_league_access_code",
        {
          p_league_id:
            league.id
        }
      );

    if (error) throw error;

    return data;
  }

  async function getAccessCodes() {
    await requireAdmin();

    const league =
      requireLeague();

    const {
      data,
      error
    } = await sb()
      .from(
        "league_access_codes"
      )
      .select(`
        id,
        league_id,
        code,
        active,
        created_at,
        created_by,
        last_access_at
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

    if (error) throw error;

    return data || [];
  }

  async function revokeAccessCode(
    codeId
  ) {
    await requireAdmin();

    requireId(
      codeId,
      "Código no válido."
    );

    const {
      data,
      error
    } = await sb()
      .rpc(
        "revoke_league_access_code",
        {
          p_code_id:
            codeId
        }
      );

    if (error) throw error;

    return data;
  }

  async function reactivateAccessCode(
    codeId
  ) {
    await requireAdmin();

    requireId(
      codeId,
      "Código no válido."
    );

    const {
      data,
      error
    } = await sb()
      .rpc(
        "reactivate_league_access_code",
        {
          p_code_id:
            codeId
        }
      );

    if (error) throw error;

    return data;
  }

  async function createLeague({
    name,
    slug,
    logoUrl = null,
    description = null
  }) {
    const cleanName =
      cleanText(name);

    if (!cleanName) {
      throw new Error(
        "El nombre de la liga es obligatorio."
      );
    }

    const cleanSlug =
      normalizeSlug(
        slug || cleanName
      );

    if (!cleanSlug) {
      throw new Error(
        "El identificador de la liga no es válido."
      );
    }

    const {
      data,
      error
    } = await sb()
      .rpc(
        "create_league",
        {
          p_name:
            cleanName,
          p_slug:
            cleanSlug,
          p_logo_url:
            cleanText(
              logoUrl
            ) || null,
          p_description:
            cleanText(
              description
            ) || null
        }
      );

    if (error) throw error;

    return data;
  }

  async function setActiveLeague(
    leagueId
  ) {
    requireId(
      leagueId,
      "Liga no válida."
    );

    const {
      data,
      error
    } = await sb()
      .rpc(
        "set_active_league",
        {
          p_league_id:
            leagueId
        }
      );

    if (error) throw error;

    return data;
  }

  async function getCurrentLeague() {
    const league =
      requireLeague();

    const {
      data,
      error
    } = await sb()
      .rpc(
        "is_current_league",
        {
          p_league_id:
            league.id
        }
      );

    if (error) throw error;

    return Boolean(data);
  }

  async function getPublicLeagueUrl() {
    const league =
      await getLeague();

    if (!league.slug) {
      return null;
    }

    /*
     * No se fija aquí un dominio de hosting.
     * El portal puede utilizar el dominio definitivo
     * cuando se publique.
     */
    return {
      slug:
        league.slug,
      leagueId:
        league.id
    };
  }

  function renderLeagueSettings(
    container,
    league
  ) {
    if (!container) {
      throw new Error(
        "No se encontró el contenedor de configuración."
      );
    }

    const data =
      league || {};

    container.innerHTML = `
      <div class="gof-settings-card">
        <div class="gof-settings-row">
          <strong>Nombre</strong>
          <span>
            ${escapeHtml(
              data.name || ""
            )}
          </span>
        </div>

        <div class="gof-settings-row">
          <strong>Identificador público</strong>
          <span>
            ${escapeHtml(
              data.slug || ""
            )}
          </span>
        </div>

        <div class="gof-settings-row">
          <strong>Estado</strong>
          <span>
            ${
              data.active
                ? "Activa"
                : "Inactiva"
            }
          </span>
        </div>
      </div>
    `;

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

  window.GOF.settings = {
    getLeague,
    updateLeague,
    getLeagueMembers,
    updateMemberRole,
    deactivateMember,
    reactivateMember,
    generateAccessCode,
    getAccessCodes,
    revokeAccessCode,
    reactivateAccessCode,
    createLeague,
    setActiveLeague,
    getCurrentLeague,
    getPublicLeagueUrl,
    normalizeSlug,
    renderLeagueSettings
  };
})();
