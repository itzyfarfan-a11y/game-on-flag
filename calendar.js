/* GAME ON FLAG — Calendario */
(function () {
  "use strict";

  const DEFAULT_FIELDS = [
    "Campo 1",
    "Campo 2",
    "Campo 3",
    "Campo 4"
  ];

  const ALL_FIELDS = [
    "Campo 1",
    "Campo 2",
    "Campo 3",
    "Campo 4",
    "Campo 5"
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

  function normalizeField(value) {
    const text = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    const match =
      /^(campo|field|cancha)\s+([1-5])$/.exec(text);

    if (!match) {
      return "";
    }

    return `Campo ${match[2]}`;
  }

  function validateField(
    fieldName,
    allowFieldFive = false
  ) {
    const field = normalizeField(fieldName);

    if (!field) {
      throw new Error(
        "Solo se permiten Campo 1 a Campo 5."
      );
    }

    if (
      field === "Campo 5" &&
      !allowFieldFive
    ) {
      throw new Error(
        "Campo 5 está reservado para administración."
      );
    }

    return field;
  }

  function getFields(
    fields = DEFAULT_FIELDS,
    allowFieldFive = false
  ) {
    const source =
      Array.isArray(fields) && fields.length
        ? fields
        : DEFAULT_FIELDS;

    const result = [
      ...new Set(
        source
          .map(field =>
            normalizeField(field)
          )
          .filter(Boolean)
      )
    ];

    if (!allowFieldFive) {
      return result.filter(
        field => field !== "Campo 5"
      );
    }

    return result;
  }

  async function listCalendar(
    tournamentId,
    options = {}
  ) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    requireLeague();

    const {
      fromDate = null,
      toDate = null,
      roundNumber = null
    } = options;

    let query = sb()
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
      .eq(
        "tournament_id",
        tournamentId
      )
      .order(
        "match_date",
        {
          ascending: true,
          nullsFirst: true
        }
      )
      .order(
        "match_time",
        {
          ascending: true,
          nullsFirst: true
        }
      )
      .order(
        "field_name",
        {
          ascending: true,
          nullsFirst: true
        }
      );

    if (fromDate) {
      query = query.gte(
        "match_date",
        normalizeDate(fromDate)
      );
    }

    if (toDate) {
      query = query.lte(
        "match_date",
        normalizeDate(toDate)
      );
    }

    if (roundNumber !== null) {
      query = query.eq(
        "round_number",
        Number(roundNumber)
      );
    }

    const {
      data,
      error
    } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function updateMatchSchedule({
    matchId,
    matchDate,
    matchTime,
    fieldName,
    force = false,
    overrideNote = null,
    allowFieldFive = false
  }) {
    if (!matchId) {
      throw new Error(
        "Partido no válido."
      );
    }

    const date =
      normalizeDate(matchDate);

    const time =
      normalizeTime(matchTime);

    const field =
      validateField(
        fieldName,
        allowFieldFive
      );

    if (
      force &&
      !String(
        overrideNote || ""
      ).trim()
    ) {
      throw new Error(
        "El cambio forzado requiere una nota de justificación."
      );
    }

    const {
      data,
      error
    } = await sb().rpc(
      "admin_update_match_schedule",
      {
        p_match_id:
          matchId,

        p_match_date:
          date,

        p_match_time:
          time,

        p_field_name:
          field,

        p_force:
          Boolean(force),

        p_override_note:
          String(
            overrideNote || ""
          ).trim() || null
      }
    );

    if (error) {
      throw error;
    }

    return data;
  }

  async function saveWeekDate({
    tournamentId,
    roundNumber,
    date
  }) {
    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    const normalizedDate =
      normalizeDate(date);

    const round =
      Number(roundNumber);

    if (
      !Number.isInteger(round) ||
      round < 1
    ) {
      throw new Error(
        "Jornada no válida."
      );
    }

    const matches =
      await listCalendar(
        tournamentId,
        {
          roundNumber: round
        }
      );

    if (!matches.length) {
      return {
        tournamentId,
        roundNumber: round,
        updated: 0
      };
    }

    let updated = 0;

    for (
      const match of matches
    ) {
      if (
        String(
          match.status || ""
        ).toLowerCase() !==
        "programado"
      ) {
        continue;
      }

      if (
        !match.match_time ||
        !match.field_name
      ) {
        continue;
      }

      await updateMatchSchedule({
        matchId:
          match.id,

        matchDate:
          normalizedDate,

        matchTime:
          match.match_time,

        fieldName:
          match.field_name,

        force:
          false
      });

      updated++;
    }

    return {
      tournamentId,
      roundNumber: round,
      date: normalizedDate,
      updated
    };
  }

  async function publishCalendar(
    tournamentId
  ) {
    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    requireLeague();

    /*
     * Primero validamos el calendario
     * antes de publicarlo.
     */
    const {
      data: validation,
      error: validationError
    } = await sb().rpc(
      "validate_nffl_schedule",
      {
        p_tournament_id:
          tournamentId
      }
    );

    if (validationError) {
      throw validationError;
    }

    if (
      validation &&
      Array.isArray(validation) &&
      validation.length
    ) {
      const invalid =
        validation.filter(
          row =>
            row.valid === false ||
            row.is_valid === false
        );

      if (invalid.length) {
        throw new Error(
          "El calendario contiene conflictos y no puede publicarse."
        );
      }
    }

    const {
      data,
      error
    } = await sb()
      .from("matches")
      .update({
        published: true
      })
      .eq(
        "tournament_id",
        tournamentId
      )
      .eq(
        "status",
        "programado"
      )
      .select();

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function unpublishCalendar(
    tournamentId
  ) {
    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("matches")
      .update({
        published: false
      })
      .eq(
        "tournament_id",
        tournamentId
      )
      .select();

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function getCalendarFields(
    tournamentId,
    options = {}
  ) {
    const {
      allowFieldFive = false
    } = options;

    const matches =
      await listCalendar(
        tournamentId
      );

    const fields =
      getFields(
        ALL_FIELDS,
        allowFieldFive
      );

    return fields.map(
      field => ({
        field,
        matches:
          matches.filter(
            match =>
              normalizeField(
                match.field_name
              ) === field
          )
      })
    );
  }

  window.GOF =
    window.GOF || {};

  window.GOF.calendar = {
    DEFAULT_FIELDS,
    ALL_FIELDS,

    normalizeDate,
    normalizeTime,
    normalizeField,
    validateField,
    getFields,

    listCalendar,
    updateMatchSchedule,
    saveWeekDate,

    publishCalendar,
    unpublishCalendar,

    getCalendarFields
  };
})();
