/* GAME ON FLAG — Programación de horarios */
(function () {
  "use strict";

  const DEFAULT_FIELDS = [
    "Campo 1",
    "Campo 2",
    "Campo 3",
    "Campo 4"
  ];

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

  function normalizeDate(value) {
    if (!value) {
      throw new Error("La fecha es obligatoria.");
    }

    const date = String(value).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(
        "La fecha debe tener formato YYYY-MM-DD."
      );
    }

    return date;
  }

  function normalizeTime(value) {
    if (!value) {
      throw new Error("La hora es obligatoria.");
    }

    let time = String(value).trim();

    if (/^\d{2}:\d{2}$/.test(time)) {
      time += ":00";
    }

    if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      throw new Error("La hora no es válida.");
    }

    const [h, m, s] = time
      .split(":")
      .map(Number);

    if (
      h < 0 ||
      h > 23 ||
      m < 0 ||
      m > 59 ||
      s < 0 ||
      s > 59
    ) {
      throw new Error("La hora no es válida.");
    }

    return time;
  }

  function timeToMinutes(value) {
    const time = normalizeTime(value);
    const [h, m] = time
      .split(":")
      .map(Number);

    return h * 60 + m;
  }

  function minutesToTime(minutes) {
    const total = Number(minutes);

    if (!Number.isFinite(total)) {
      throw new Error("Hora inválida.");
    }

    const h = Math.floor(total / 60);
    const m = total % 60;

    if (h > 23) {
      throw new Error("La hora resultante no es válida.");
    }

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }

  function buildTimeSlots({
    startTime = "08:00",
    endTime = "13:00",
    durationMinutes = 40,
    toleranceMinutes = 10
  } = {}) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);

    const duration =
      Number(durationMinutes) || 40;

    const tolerance =
      Number(toleranceMinutes) || 10;

    if (duration <= 0) {
      throw new Error(
        "La duración del partido debe ser mayor a cero."
      );
    }

    const block = duration + tolerance;

    const slots = [];

    for (
      let current = start;
      current + duration <= end;
      current += block
    ) {
      slots.push({
        start: minutesToTime(current),
        end: minutesToTime(
          current + duration
        )
      });
    }

    return slots;
  }

  function hasTeamConflict(
    candidate,
    scheduled
  ) {
    return (scheduled || []).some(match => {
      if (
        match.match_date !==
        candidate.match_date
      ) {
        return false;
      }

      if (
        match.match_time !==
        candidate.match_time
      ) {
        return false;
      }

      return (
        match.home_team_id ===
          candidate.home_team_id ||
        match.home_team_id ===
          candidate.away_team_id ||
        match.away_team_id ===
          candidate.home_team_id ||
        match.away_team_id ===
          candidate.away_team_id
      );
    });
  }

  function hasFieldConflict(
    candidate,
    scheduled
  ) {
    return (scheduled || []).some(match => {
      return (
        match.match_date ===
          candidate.match_date &&
        match.match_time ===
          candidate.match_time &&
        String(match.field_name || "")
          .toLowerCase() ===
          String(candidate.field_name || "")
            .toLowerCase()
      );
    });
  }

  async function getScheduledMatches(
    tournamentId
  ) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    requireLeague();

    const { data, error } = await sb()
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
        status,
        is_makeup,
        published,
        schedule_manual_override,
        schedule_override_note,
        schedule_generated_at
      `)
      .eq("tournament_id", tournamentId)
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

    return data || [];
  }

  async function generateTournamentSchedule({
    tournamentId,
    roundDates,
    startTime = "08:00",
    endTime = "13:00",
    durationMinutes = 40,
    toleranceMinutes = 10,
    fields = DEFAULT_FIELDS,
    force = false
  }) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    if (
      !Array.isArray(roundDates) ||
      !roundDates.length
    ) {
      throw new Error(
        "Debes proporcionar las fechas de las jornadas."
      );
    }

    const validFields =
      Array.isArray(fields) && fields.length
        ? fields
        : DEFAULT_FIELDS;

    const dates = roundDates.map(
      normalizeDate
    );

    const slots = buildTimeSlots({
      startTime,
      endTime,
      durationMinutes,
      toleranceMinutes
    });

    if (!slots.length) {
      throw new Error(
        "No existen horarios disponibles en el rango indicado."
      );
    }

    const matches =
      await getScheduledMatches(
        tournamentId
      );

    const pending = matches.filter(
      match =>
        !match.is_makeup &&
        ["
