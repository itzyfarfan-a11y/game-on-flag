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

  function requireId(value, message) {
    if (!value) {
      throw new Error(message);
    }

    return value;
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function normalizePlayer(player) {
    if (!player || typeof player !== "object") {
      throw new Error(
        "Jugador no válido."
      );
    }

    const fullName =
      cleanText(player.full_name);

    const photoUrl =
      cleanText(player.photo_url);

    const jerseyNumber =
      Number(player.jersey_number);

    const curp =
      cleanText(player.curp);

    const dateOfBirth =
      cleanText(player.date_of_birth);

    return {
      id:
        player.id ||
        player.player_id ||
        null,

      full_name:
        fullName,

      photo_url:
        photoUrl,

      jersey_number:
        jerseyNumber,

      curp:
        curp || null,

      date_of_birth:
        dateOfBirth || null
    };
  }

  function validatePlayers(
    players,
    options = {}
  ) {
    if (!Array.isArray(players)) {
      throw new Error(
        "El roster debe ser una lista de jugadores."
      );
    }

    if (
      players.length < 1 ||
      players.length > 18
    ) {
      throw new Error(
        "El roster debe tener entre 1 y 18 jugadores."
      );
    }

    const jerseys =
      new Set();

    const requireCurp =
      Boolean(options.requireCurp);

    const normalized =
      players.map(
        (player, index) => {
          const normalizedPlayer =
            normalizePlayer(player);

          if (
            !normalizedPlayer.full_name
          ) {
            throw new Error(
              `Falta el nombre del jugador ${index + 1}.`
            );
          }

          if (
            !normalizedPlayer.photo_url
          ) {
            throw new Error(
              `Falta la fotografía del jugador ${index + 1}.`
            );
          }

          if (
            !Number.isInteger(
              normalizedPlayer.jersey_number
            ) ||
            normalizedPlayer.jersey_number < 0 ||
            normalizedPlayer.jersey_number > 99
          ) {
            throw new Error(
              `El número del jugador ${index + 1} debe estar entre 0 y 99.`
            );
          }

          if (
            jerseys.has(
              normalizedPlayer.jersey_number
            )
          ) {
            throw new Error(
              `El número ${normalizedPlayer.jersey_number} está repetido en el roster.`
            );
          }

          jerseys.add(
            normalizedPlayer.jersey_number
          );

          if (
            requireCurp &&
            !normalizedPlayer.curp
          ) {
            throw new Error(
              `Falta la CURP del jugador ${index + 1}.`
            );
          }

          return normalizedPlayer;
        }
      );

    return normalized;
  }

  async function verifyTournamentTeam(
    tournamentId,
    categoryId,
    teamId
  ) {
    const league =
      requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("tournament_teams")
      .select(`
        id,
        tournament_id,
        category_id,
        team_id,
        active,
        teams (
          id,
          name,
          league_id
        )
      `)
      .eq(
        "tournament_id",
        tournamentId
      )
      .eq(
        "category_id",
        categoryId
      )
      .eq(
        "team_id",
        teamId
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "El equipo no está registrado activamente en este torneo y categoría."
      );
    }

    if (
      !data.teams ||
      data.teams.league_id !==
        league.id
    ) {
      throw new Error(
        "El equipo no pertenece a la liga activa."
      );
    }

    return data;
  }

  async function getTournamentTeamRoster(
    tournamentId,
    categoryId,
    teamId
  ) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

    requireId(
      categoryId,
      "Categoría no válida."
    );

    requireId(
      teamId,
      "Equipo no válido."
    );

    const league =
      requireLeague();

    await verifyTournamentTeam(
      tournamentId,
      categoryId,
      teamId
    );

    const {
      data,
      error
    } = await sb()
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
      .eq(
        "tournament_id",
        tournamentId
      )
      .eq(
        "category_id",
        categoryId
      )
      .eq(
        "team_id",
        teamId
      )
      .order(
        "players(full_name)",
        {
          ascending: true
        }
      );

    if (error) {
      throw error;
    }

    return (data || [])
      .filter(
        row =>
          row.players &&
          row.players.league_id ===
            league.id
      )
      .map(row => ({
        ...row,
        player:
          normalizePlayer(
            row.players
          )
      }));
  }

  async function getRosterSummary(
    tournamentId,
    categoryId,
    teamId
  ) {
    const roster =
      await getTournamentTeamRoster(
        tournamentId,
        categoryId,
        teamId
      );

    return {
      tournamentId,
      categoryId,
      teamId,
      total:
        roster.length,
      approved:
        roster.filter(
          row => row.approved === true
        ).length,
      pending:
        roster.filter(
          row => row.approved !== true
        ).length,
      players:
        roster
    };
  }

  async function validateRosterForCategory(
    tournamentId,
    categoryId,
    teamId,
    players
  ) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

    requireId(
      categoryId,
      "Categoría no válida."
    );

    requireId(
      teamId,
      "Equipo no válido."
    );

    await verifyTournamentTeam(
      tournamentId,
      categoryId,
      teamId
    );

    const {
      data: category,
      error
    } = await sb()
      .from("categories")
      .select(
        "id,name,league_id"
      )
      .eq(
        "id",
        categoryId
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!category) {
      throw new Error(
        "Categoría no encontrada."
      );
    }

    const name =
      String(
        category.name || ""
      ).toLowerCase();

    const requireCurp =
      name.includes("30+") ||
      name.includes("35+") ||
      name.includes("30 +") ||
      name.includes("35 +");

    return validatePlayers(
      players,
      {
        requireCurp
      }
    );
  }

  window.GOF =
    window.GOF || {};

  window.GOF.roster = {
    validatePlayers,
    normalizePlayer,
    getTournamentTeamRoster,
    getRosterSummary,
    validateRosterForCategory,
    verifyTournamentTeam
  };
})();
