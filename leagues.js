/* GAME ON FLAG — Ligas / Organizadores y liga activa */
(function () {
  "use strict";

  function sb() {
    if (!window.GOF || !window.GOF.supabase) {
      throw new Error(
        "La sesión de GAME ON FLAG todavía no está inicializada."
      );
    }

    return window.GOF.supabase;
  }

  async function listMyLeagues() {
    const client = sb();

    const {
      data: memberships,
      error: membershipError
    } = await client
      .from("league_members")
      .select(
        "league_id,role,active,is_current,last_access_at"
      )
      .eq("active", true);

    if (membershipError) throw membershipError;

    const ids = [
      ...new Set(
        (memberships || [])
          .map(row => row.league_id)
          .filter(Boolean)
      )
    ];

    if (!ids.length) return [];

    const {
      data: leagues,
      error: leagueError
    } = await client
      .from("leagues")
      .select(
        "id,name,slug,logo_url,primary_color,contact_info,owner_id,status,created_at"
      )
      .in("id", ids)
      .eq("status", "active")
      .order("name");

    if (leagueError) throw leagueError;

    const membershipByLeague = new Map(
      (memberships || []).map(row => [
        row.league_id,
        row
      ])
    );

    return (leagues || []).map(league => ({
      ...league,
      membership:
        membershipByLeague.get(league.id) || null
    }));
  }

  async function getCurrentLeague() {
    const leagues = await listMyLeagues();

    return (
      leagues.find(
        item =>
          item.membership &&
          item.membership.is_current
      ) || null
    );
  }

  async function setActiveLeague(leagueId) {
    if (!leagueId) {
      throw new Error("Liga no válida.");
    }

    const {
      data,
      error
    } = await sb().rpc("set_active_league", {
      p_league_id: leagueId
    });

    if (error) throw error;

    window.dispatchEvent(
      new CustomEvent("gof:league-changed", {
        detail: {
          leagueId,
          result: data
        }
      })
    );

    return data;
  }

  async function redeemAccessCode(code) {
    const cleanCode = String(code || "").trim();

    if (!cleanCode) {
      throw new Error(
        "Escribe el código de acceso."
      );
    }

    const {
      data,
      error
    } = await sb().rpc(
      "redeem_league_access_code",
      {
        p_code: cleanCode
      }
    );

    if (error) throw error;

    window.dispatchEvent(
      new CustomEvent("gof:league-changed", {
        detail: {
          result: data
        }
      })
    );

    return data;
  }

  async function createLeague(
    name,
    slug,
    logoUrl,
    contactInfo
  ) {
    const cleanName = String(name || "").trim();
    const cleanSlug = String(slug || "")
      .trim()
      .toLowerCase();

    if (!cleanName) {
      throw new Error(
        "El nombre de la liga es obligatorio."
      );
    }

    if (!cleanSlug) {
      throw new Error(
        "El slug de la liga es obligatorio."
      );
    }

    const {
      data,
      error
    } = await sb().rpc("create_league", {
      p_name: cleanName,
      p_slug: cleanSlug,
      p_logo_url:
        String(logoUrl || "").trim() || null,
      p_contact_info:
        contactInfo || {}
    });

    if (error) throw error;

    window.dispatchEvent(
      new CustomEvent("gof:league-created", {
        detail: {
          result: data
        }
      })
    );

    return data;
  }

  window.GOF = window.GOF || {};

  window.GOF.leagues = {
    listMyLeagues,
    getCurrentLeague,
    setActiveLeague,
    redeemAccessCode,
    createLeague
  };
})();
