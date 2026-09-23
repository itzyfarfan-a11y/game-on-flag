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

  function requireId(id, label) {
    if (!id) {
      throw new Error((label || "Registro") + " no válido.");
    }

    return id;
  }

  function normalizeTeam(team) {
    if (!team) {
      return null;
    }

    return {
      id: team.id,
      name: team.name || "",
      logo_url: team.logo_url || null,
      coach_id: team.coach_id || null,
      club_name: team.club_name || null,
      created_at: team.created_at || null,
      league_id: team.league_id || null
    };
  }

  async function listTeams() {
    const league = requireLeague();

    const { data, error } = await sb()
      .from("teams")
      .select(
        "id,name,logo_url,coach_id,club_name,created_at,league_id"
      )
      .eq("league_id", league.id)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map(normalizeTeam);
  }

  async function getTeam(teamId) {
    const league = requireLeague();

    requireId(teamId, "Equipo");

    const { data, error } = await sb()
      .from("teams")
      .select(
        "id,name,logo_url,coach_id,club_name,created_at,league_id"
      )
      .eq("id", teamId)
      .eq("league_id", league.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "El equipo no pertenece a la liga activa."
      );
    }

    return normalizeTeam(data);
  }

  async function createTeam(payload) {
    const league = requireLeague();

    const input = payload || {};
    const name = String(input.name || "").trim();

    if (!name) {
      throw new Error(
        "El nombre del equipo es obligatorio."
      );
    }

    if (name.length > 120) {
      throw new Error(
        "El nombre del equipo es demasiado largo."
      );
    }

    const row = {
      name,
      league_id: league.id,
      logo_url: input.logo_url
        ? String(input.logo_url).trim()
        : null,
      coach_id: input.coach_id || null,
      club_name: input.club_name
        ? String(input.club_name).trim()
        : null
    };

    const { data, error } = await sb()
      .from("teams")
      .insert(row)
      .select(
        "id,name,logo_url,coach_id,club_name,created_at,league_id"
      )
      .single();

    if (error) {
      throw error;
    }

    return normalizeTeam(data);
  }

  async function updateTeamName(teamId, name) {
    requireId(teamId, "Equipo");

    const cleanName = String(name || "").trim();

    if (!cleanName) {
      throw new Error(
        "El nombre del equipo es obligatorio."
      );
    }

    if (cleanName.length > 120) {
      throw new Error(
        "El nombre del equipo es demasiado largo."
      );
    }

    const { error } = await sb().rpc(
      "admin_update_team_name",
      {
        p_team_id: teamId,
        p_name: cleanName
      }
    );

    if (error) {
      throw error;
    }

    return getTeam(teamId);
  }

  async function updateTeam(teamId, changes) {
    const league = requireLeague();

    requireId(teamId, "Equipo");

    const input = changes || {};
    const update = {};

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "logo_url"
      )
    ) {
      update.logo_url = input.logo_url
        ? String(input.logo_url).trim()
        : null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "coach_id"
      )
    ) {
      update.coach_id = input.coach_id || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        "club_name"
      )
    ) {
      update.club_name = input.club_name
        ? String(input.club_name).trim()
        : null;
    }

    if (!Object.keys(update).length) {
      return getTeam(teamId);
    }

    const { data, error } = await sb()
      .from("teams")
      .update(update)
      .eq("id", teamId)
      .eq("league_id", league.id)
      .select(
        "id,name,logo_url,coach_id,club_name,created_at,league_id"
      )
      .single();

    if (error) {
      throw error;
    }

    return normalizeTeam(data);
  }

  async function deleteTeam(teamId) {
    const league = requireLeague();

    requireId(teamId, "Equipo");

    const team = await getTeam(teamId);

    if (!team || team.league_id !== league.id) {
      throw new Error(
        "El equipo no pertenece a la liga activa."
      );
    }

    const { error } = await sb().rpc(
      "admin_delete_team",
      {
        p_team_id: teamId
      }
    );

    if (error) {
      throw error;
    }

    return true;
  }

  async function replaceTournamentTeam(
    tournamentTeamId,
    newTeamId,
    note
  ) {
    requireId(
      tournamentTeamId,
      "Inscripción del torneo"
    );

    requireId(newTeamId, "Nuevo equipo");

    const { data, error } = await sb().rpc(
      "replace_tournament_team",
      {
        p_tournament_team_id: tournamentTeamId,
        p_new_team_id: newTeamId,
        p_note: note
          ? String(note).trim()
          : null
      }
    );

    if (error) {
      throw error;
    }

    return data;
  }

  window.GOF = window.GOF || {};

  window.GOF.teams = {
    listTeams,
    getTeam,
    createTeam,
    updateTeam,
    updateTeamName,
    deleteTeam,
    replaceTournamentTeam
  };
})();
