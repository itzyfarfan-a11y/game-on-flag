/* GAME ON FLAG — Roster */
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

  function validatePlayers(players) {
    if (!Array.isArray(players)) {
      throw new Error("El roster debe ser una lista de jugadores.");
    }

    if (players.length < 1 || players.length > 18) {
      throw new Error("El roster debe tener entre 1 y 18 jugadores.");
    }

    const jerseys = new Set();

    players.forEach((player, index) => {
      const number = Number(player.jersey_number);

      if (!String(player.full_name || "").trim()) {
        throw new Error(
          `Falta el nombre del jugador ${index + 1}.`
        );
      }

      if (!String(player.photo_url || "").trim()) {
        throw new Error(
          `Falta la fotografía del jugador ${index + 1}.`
        );
      }

      if (!Number.isInteger(number) || number < 0 || number > 99) {
        throw new Error(
          `El número del jugador ${index + 1} debe estar entre 0 y 99.`
        );
      }

      if (jerseys.has(number)) {
        throw new Error(
          `El número ${number} está repetido en el roster.`
        );
      }

      jerseys.add(number);
    });

    return players;
  }

  async function getTournamentTeamRoster(
    tournamentId,
    categoryId,
    teamId
  ) {
    if (!tournamentId || !categoryId || !teamId) {
      throw new Error("Torneo, categoría o equipo no válidos.");
    }

    const league = requireLeague();

    const { data, error } = await sb()
      .from("roster_registrations")
      .select(`
        id,
        tournament_id,
        category_id,
        team_id,
        player_id,
        approved,
        approved_at,
        approved_by,
        players (
          id,
          profile_id,
          full_name,
          photo_url,
          jersey_number,
          curp,
          date_of_birth,
          league_id
        )
      `)
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId)
      .eq("team_id", teamId);

    if (error) throw error;

    return (data || []).filter(
      row =>
        row.players &&
        row.players.league_id === league.id
    );
  }

 
