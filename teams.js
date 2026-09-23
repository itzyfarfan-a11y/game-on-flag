/* GAME ON FLAG — Equipos */
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

  async function listTeams() {
    const league = requireLeague();

    const { data, error } = await sb()
      .from("teams")
      .select(`
        id,
        name,
        logo_url,
        coach_id,
        club_name,
        created_at,
        league_id
      `)
      .eq("league_id", league.id)
      .order("name", { ascending: true });

    if (error) throw error;

    return data || [];
  }

  async function getTeam(teamId) {
    if (!teamId) {
      throw new Error("Equipo no válido.");
    }

    const league = requireLeague();

    const { data, error } = await sb()
      .from("teams")
      .select(`
        id,
       
