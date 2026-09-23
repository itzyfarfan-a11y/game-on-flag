/* GAME ON FLAG — Torneos */
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

  async function listTournaments() {
    const league = requireLeague();

    const { data, error } = await sb()
      .from("tournaments")
      .select(
        "id,name,season,start_date,end_date,status,regular_rounds,created_by,created_at,tournament_type,league_id"
      )
      .eq("league_id", league.id)
      .order("start_date", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    return data || [];
  }

  async function getTournament(tournamentId) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    const league = requireLeague();

    const { data, error } = await sb()
      .from("tournaments")
      .select(
        "id,name,season,start_date,end_date,status,regular_rounds,created_by,created_at,tournament_type,league_id"
      )
      .eq("id", tournamentId)
      .eq("league_id", league.id)
      .maybeSingle();

    if (error) throw error;

    return data || null;
  }

  async function createTournament(values) {
    const league = requireLeague();

    const payload = {
      name: String(values?.name || "").trim(),
      season: String(values?.season || "").trim() || null,
      start_date: values?.start_date || null,
      end_date: values?.end_date || null,
      status: values?.status || "proximo",
      regular_rounds: Number(values?.regular_rounds || 7),
      tournament_type: values?.tournament_type || "regular",
      league_id: league.id
    };

    if (!payload.name) {
      throw new Error("El nombre del torneo es obligatorio.");
    }

    if (![3, 7].includes(payload.regular_rounds)) {
      throw new Error("Las jornadas regulares deben ser 3 o 7.");
    }

    if (!["regular", "relampago"].includes(payload.tournament_type)) {
      throw new Error("Tipo de torneo no válido.");
    }

    if (!["proximo", "activo", "finalizado"].includes(payload.status)) {
      throw new Error("Estado de torneo no válido.");
    }

    const { data, error } = await sb()
      .from("tournaments")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function updateTournament(tournamentId, values) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    const league = requireLeague();

    const payload = {
      name: String(values?.name || "").trim(),
      season: String(values?.season || "").trim() || null,
      start_date: values?.start_date || null,
      end_date: values?.end_date || null,
      status: values?.status || "proximo",
      regular_rounds: Number(values?.regular_rounds || 7),
      tournament_type: values?.tournament_type || "regular"
    };

    if (!payload.name) {
      throw new Error("El nombre del torneo es obligatorio.");
    }

    if (![3, 7].includes(payload.regular_rounds)) {
      throw new Error("Las jornadas regulares deben ser 3 o 7.");
    }

    const { data, error } = await sb()
      .from("tournaments")
      .update(payload)
      .eq("id", tournamentId)
      .eq("league_id", league.id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function deleteTournament(tournamentId) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    requireLeague();

    const { data, error } = await sb().rpc(
      "delete_tournament",
      {
        p_tournament_id: tournamentId
      }
    );

    if (error) throw error;

    return data;
  }

  window.GOF = window.GOF || {};

  window.GOF.tournaments = {
    listTournaments,
    getTournament,
    createTournament,
    updateTournament,
    deleteTournament
  };
})();
