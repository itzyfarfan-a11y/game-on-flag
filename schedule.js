/* GAME ON FLAG — Programación de horarios */
(function () {
  "use strict";

  /*
   * CAMPOS NORMALES
   *
   * Campo 5 existe, pero se habilita únicamente
   * cuando administración lo solicita.
   */
  const DEFAULT_FIELDS = [
    "Campo 1",
    "Campo 2",
    "Campo 3",
    "Campo 4"
  ];

  const ADMIN_FIELDS = [
    "Campo 1",
    "Campo 2",
    "Campo 3",
    "Campo 4",
    "Campo 5"
  ];

  /*
   * DURACIÓN OFICIAL
   *
   * 40 minutos de juego
   * + 10 minutos de tolerancia
   *
   * Resultado:
   * 08:00
   * 08:50
   * 09:40
   * 10:30
   * 11:20
   * 12:10
   */
  const DEFAULT_GAME_MINUTES = 40;
  const DEFAULT_TOLERANCE_MINUTES = 10;

  function sb() {
    if (
      !window.GOF ||
      !window.GOF.supabase
    ) {
      throw new Error(
        "Supabase no está inicializado."
      );
    }

    return window.GOF.supabase;
  }

  function requireLeague() {
    const league =
      window.GOF &&
      window.GOF.context &&
      window.GOF.context.activeLeague;

    if (
      !league ||
      !league.id
    ) {
      throw new Error(
        "No hay una liga activa."
      );
    }

    return league;
  }

  function normalizeDate(value) {
    if (!value) {
      throw new Error(
        "La fecha es obligatoria."
      );
    }

    const date =
      String(value).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        date
      )
    ) {
      throw new Error(
        "La fecha debe tener formato YYYY-MM-DD."
      );
    }

    return date;
  }

  function normalizeTime(value) {
    if (!value) {
      throw new Error(
        "La hora es obligatoria."
      );
    }

    let time =
      String(value).trim();

    if (
      /^\d{2}:\d{2}$/.test(time)
    ) {
      time += ":00";
    }

    if (
      !/^\d{2}:\d{2}:\d{2}$/.test(
        time
      )
    ) {
      throw new Error(
        "La hora no es válida."
      );
    }

    const [h, m, s] =
      time
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
      throw new Error(
        "La hora no es válida."
      );
    }

    return time;
  }

  function normalizeTimeSafe(value) {
    if (!value) {
      return null;
    }

    let text =
      String(value).trim();

    if (
      /^\d{2}:\d{2}$/.test(text)
    ) {
      text += ":00";
    }

    return text;
  }

  function timeToMinutes(value) {
    const time =
      normalizeTime(value);

    const [h, m] =
      time
        .split(":")
        .map(Number);

    return (
      h * 60 +
      m
    );
  }

  function minutesToTime(minutes) {
    const total =
      Number(minutes);

    if (
      !Number.isFinite(total)
    ) {
      throw new Error(
        "Hora inválida."
      );
    }

    if (
      total < 0 ||
      total > 1439
    ) {
      throw new Error(
        "La hora resultante no es válida."
      );
    }

    const h =
      Math.floor(
        total / 60
      );

    const m =
      total % 60;

    return (
      `${String(h).padStart(2, "0")}:` +
      `${String(m).padStart(2, "0")}:00`
    );
  }

  /*
   * GENERADOR DE HORARIOS
   *
   * 40 minutos de partido
   * + 10 minutos de tolerancia.
   *
   * Ejemplo:
   *
   * 08:00 - 08:40
   * 08:50 - 09:30
   * 09:40 - 10:20
   * 10:30 - 11:10
   * 11:20 - 12:00
   * 12:10 - 12:50
   */
  function buildTimeSlots({
    startTime = "08:00",
    endTime = "13:00",
    durationMinutes =
      DEFAULT_GAME_MINUTES,
    toleranceMinutes =
      DEFAULT_TOLERANCE_MINUTES
  } = {}) {
    const start =
      timeToMinutes(
        startTime
      );

    const end =
      timeToMinutes(
        endTime
      );

    const duration =
      Number(
        durationMinutes
      );

    const tolerance =
      Number(
        toleranceMinutes
      );

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      throw new Error(
        "La duración del partido debe ser mayor a cero."
      );
    }

    if (
      !Number.isFinite(tolerance) ||
      tolerance < 0
    ) {
      throw new Error(
        "La tolerancia no puede ser negativa."
      );
    }

    if (
      start >= end
    ) {
      throw new Error(
        "La hora inicial debe ser menor que la hora final."
      );
    }

    const block =
      duration +
      tolerance;

    const slots = [];

    for (
      let current = start;
      current + duration <= end;
      current += block
    ) {
      slots.push({
        start:
          minutesToTime(
            current
          ),
        end:
          minutesToTime(
            current +
              duration
          )
      });
    }

    return slots;
  }

  /*
   * Acepta:
   *
   * Campo 1
   * Campo 2
   * Campo 3
   * Campo 4
   * Campo 5
   *
   * También:
   * field 1
   * cancha 1
   */
  function normalizeFieldName(
    value
  ) {
    const text =
      String(value || "")
        .trim();

    if (!text) {
      return "";
    }

    const normalized =
      text
        .toLowerCase()
        .replace(
          /\s+/g,
          " "
        );

    const match =
      /^(campo|field|cancha)\s+([1-5])$/.exec(
        normalized
      );

    if (!match) {
      return "";
    }

    return `Campo ${match[2]}`;
  }

  function getFields({
    fields = DEFAULT_FIELDS,
    allowFieldFive = false
  } = {}) {
    const source =
      Array.isArray(fields) &&
      fields.length
        ? fields
        : DEFAULT_FIELDS;

    const normalized =
      source
        .map(
          normalizeFieldName
        )
        .filter(Boolean);

    const unique =
      [
        ...new Set(
          normalized
        )
      ];

    if (
      !allowFieldFive
    ) {
      return unique.filter(
        field =>
          field !==
          "Campo 5"
      );
    }

    return unique;
  }

  function hasTeamConflict(
    candidate,
    scheduled
  ) {
    return (
      scheduled || []
    ).some(match => {
      if (
        match.id &&
        candidate.id &&
        match.id ===
          candidate.id
      ) {
        return false;
      }

      if (
        match.match_date !==
        candidate.match_date
      ) {
        return false;
      }

      if (
        normalizeTimeSafe(
          match.match_time
        ) !==
        normalizeTimeSafe(
          candidate.match_time
        )
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
    const candidateField =
      normalizeFieldName(
        candidate.field_name
      );

    if (!candidateField) {
      return true;
    }

    return (
      scheduled || []
    ).some(match => {
      if (
        match.id &&
        candidate.id &&
        match.id ===
          candidate.id
      ) {
        return false;
      }

      return (
        match.match_date ===
          candidate.match_date &&
        normalizeTimeSafe(
          match.match_time
        ) ===
          normalizeTimeSafe(
            candidate.match_time
          ) &&
        normalizeFieldName(
          match.field_name
        ) ===
          candidateField
      );
    });
  }

  function isScheduledStatus(
    status
  ) {
    return [
      "programado",
      "jugado",
      "incomparecencia"
    ].includes(
      String(
        status || ""
      ).toLowerCase()
    );
  }

  async function getScheduledMatches(
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
    } =
      await sb()
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
          "round_number",
          {
            ascending: true
          }
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

    if (error) {
      throw error;
    }

    return data || [];
  }

  function groupMatchesByRound(
    matches
  ) {
    const groups =
      new Map();

    for (
      const match of
        matches || []
    ) {
      const round =
        Number(
          match.round_number
        );

      if (
        !Number.isInteger(
          round
        ) ||
        round < 1
      ) {
        continue;
      }

      if (
        !groups.has(
          round
        )
      ) {
        groups.set(
          round,
          []
        );
      }

      groups
        .get(round)
        .push(match);
    }

    return groups;
  }

  function sortMatchesForScheduling(
    matches
  ) {
    return [
      ...(matches || [])
    ].sort(
      (a, b) => {
        const categoryA =
          String(
            a.category_id || ""
          );

        const categoryB =
          String(
            b.category_id || ""
          );

        if (
          categoryA !==
          categoryB
        ) {
          return categoryA.localeCompare(
            categoryB
          );
        }

        return String(
          a.id || ""
        ).localeCompare(
          String(
            b.id || ""
          )
        );
      }
    );
  }

  function findAvailableSlot({
    match,
    date,
    slots,
    fields,
    scheduled
  }) {
    for (
      const slot of slots
    ) {
      for (
        const field of
          fields
      ) {
        const candidate =
          {
            id:
              match.id,

            match_date:
              date,

            match_time:
              slot.start,

            field_name:
              field,

            home_team_id:
              match.home_team_id,

            away_team_id:
              match.away_team_id
          };

        if (
          hasTeamConflict(
            candidate,
            scheduled
          )
        ) {
          continue;
        }

        if (
          hasFieldConflict(
            candidate,
            scheduled
          )
        ) {
          continue;
        }

        return candidate;
      }
    }

    return null;
  }

  /*
   * CAMPO 5:
   *
   * La interfaz puede mostrarlo para administración,
   * pero Supabase decide finalmente si el usuario tiene
   * permisos para utilizarlo.
   */
  async function updateMatchSchedule({
    matchId,
    matchDate,
    matchTime,
    fieldName,
    force = false,
    overrideNote = null
  }) {
    if (!matchId) {
      throw new Error(
        "Partido no válido."
      );
    }

    const date =
      normalizeDate(
        matchDate
      );

    const time =
      normalizeTime(
        matchTime
      );

    const field =
      normalizeFieldName(
        fieldName
      );

    if (!field) {
      throw new Error(
        "Solo se permiten Campo 1 a Campo 5."
      );
    }

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
    } =
      await sb().rpc(
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
            ).trim() ||
            null
        }
      );

    if (error) {
      throw error;
    }

    return data;
  }

  /*
   * GENERACIÓN AUTOMÁTICA
   *
   * Por defecto:
   * Campo 1–4.
   *
   * Para utilizar Campo 5:
   *
   * fields: [
   *   "Campo 1",
   *   "Campo 2",
   *   "Campo 3",
   *   "Campo 4",
   *   "Campo 5"
   * ]
   *
   * allowFieldFive: true
   */
  async function generateTournamentSchedule({
    tournamentId,
    roundDates,
    startTime = "08:00",
    endTime = "13:00",
    durationMinutes =
      DEFAULT_GAME_MINUTES,
    toleranceMinutes =
      DEFAULT_TOLERANCE_MINUTES,
    fields = DEFAULT_FIELDS,
    allowFieldFive = false,
    force = false
  }) {
    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    if (
      !Array.isArray(
        roundDates
      ) ||
      !roundDates.length
    ) {
      throw new Error(
        "Debes proporcionar las fechas de las jornadas."
      );
    }

    const validFields =
      getFields({
        fields,
        allowFieldFive
      });

    if (
      !validFields.length
    ) {
      throw new Error(
        "No existen campos válidos para programar."
      );
    }

    const dates =
      roundDates.map(
        normalizeDate
      );

    const slots =
      buildTimeSlots({
        startTime,
        endTime,
        durationMinutes,
        toleranceMinutes
      });

    if (
      !slots.length
    ) {
      throw new Error(
        "No existen horarios disponibles en el rango indicado."
      );
    }

    const matches =
      await getScheduledMatches(
        tournamentId
      );

    const groups =
      groupMatchesByRound(
        matches
      );

    const scheduled =
      [...matches];

    const results = [];
    const skipped = [];
    const conflicts = [];

    for (
      let roundIndex = 0;
      roundIndex <
        dates.length;
      roundIndex++
    ) {
      const roundNumber =
        roundIndex + 1;

      const date =
        dates[
          roundIndex
        ];

      const roundMatches =
        sortMatchesForScheduling(
          groups.get(
            roundNumber
          ) || []
        );

      for (
        const match of
          roundMatches
      ) {
        /*
         * No tocar partidos que ya
         * tengan un resultado.
         */
        if (
          String(
            match.status || ""
          ).toLowerCase() !==
          "programado"
        ) {
          skipped.push({
            matchId:
              match.id,

            roundNumber,

            reason:
              "El partido no está en estado programado."
          });

          continue;
        }

        /*
         * Si ya tiene fecha/hora/campo,
         * se conserva salvo que force=true.
         */
        if (
          match.match_date &&
          match.match_time &&
          match.field_name &&
          !force
        ) {
          scheduled.push({
            ...match,

            match_date:
              normalizeDate(
                match.match_date
              ),

            match_time:
              normalizeTime(
                match.match_time
              ),

            field_name:
              normalizeFieldName(
                match.field_name
              )
          });

          skipped.push({
            matchId:
              match.id,

            roundNumber,

            reason:
              "El partido ya tenía programación."
          });

          continue;
        }

        const candidate =
          findAvailableSlot({
            match,
            date,
            slots,
            fields:
              validFields,
            scheduled
          });

        if (
          !candidate
        ) {
          conflicts.push({
            matchId:
              match.id,

            roundNumber,

            date,

            reason:
              "No existe un horario/campo disponible sin conflicto."
          });

          continue;
        }

        try {
          const response =
            await updateMatchSchedule({
              matchId:
                match.id,

              matchDate:
                candidate.match_date,

              matchTime:
                candidate.match_time,

              fieldName:
                candidate.field_name,

              force:
                Boolean(force),

              overrideNote:
                force
                  ? "Programación automática del calendario."
                  : null
            });

          scheduled.push({
            ...match,
            ...candidate
          });

          results.push({
            matchId:
              match.id,

            roundNumber,

            date:
              candidate.match_date,

            time:
              candidate.match_time,

            field:
              candidate.field_name,

            response
          });
        } catch (error) {
          conflicts.push({
            matchId:
              match.id,

            roundNumber,

            date,

            reason:
              error &&
              error.message
                ? error.message
                : "No fue posible programar el partido."
          });
        }
      }
    }

    return {
      tournamentId,

      rounds:
        dates.length,

      fields:
        validFields,

      timeSlots:
        slots,

      scheduled:
        results,

      skipped,

      conflicts,

      totalUpdated:
        results.length,

      totalSkipped:
        skipped.length,

      totalConflicts:
        conflicts.length
    };
  }

  async function validateTournamentSchedule(
    tournamentId
  ) {
    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    const matches =
      await getScheduledMatches(
        tournamentId
      );

    const errors = [];

    for (
      const match of
        matches
    ) {
      if (
        !match.match_date ||
        !match.match_time ||
        !match.field_name
      ) {
        errors.push({
          matchId:
            match.id,

          reason:
            "El partido no tiene fecha, hora o campo."
        });

        continue;
      }

      const candidate =
        {
          id:
            match.id,

          match_date:
            match.match_date,

          match_time:
            normalizeTimeSafe(
              match.match_time
            ),

          field_name:
            normalizeFieldName(
              match.field_name
            ),

          home_team_id:
            match.home_team_id,

          away_team_id:
            match.away_team_id
        };

      if (
        !candidate.field_name
      ) {
        errors.push({
          matchId:
            match.id,

          reason:
            "El campo no es válido."
        });
      }

      const others =
        matches.filter(
          other =>
            other.id !==
            match.id
        );

      if (
        hasTeamConflict(
          candidate,
          others
        )
      ) {
        errors.push({
          matchId:
            match.id,

          reason:
            "El equipo aparece en dos partidos al mismo tiempo."
        });
      }

      if (
        hasFieldConflict(
          candidate,
          others
        )
      ) {
        errors.push({
          matchId:
            match.id,

          reason:
            "El campo está ocupado por otro partido al mismo tiempo."
        });
      }
    }

    return {
      tournamentId,

      valid:
        errors.length === 0,

      errors
    };
  }

  async function getAvailableSlots({
    tournamentId,
    date,
    startTime = "08:00",
    endTime = "13:00",
    durationMinutes =
      DEFAULT_GAME_MINUTES,
    toleranceMinutes =
      DEFAULT_TOLERANCE_MINUTES,
    fields = DEFAULT_FIELDS,
    allowFieldFive = false
  }) {
    if (!tournamentId) {
      throw new Error(
        "Torneo no válido."
      );
    }

    const normalizedDate =
      normalizeDate(
        date
      );

    const validFields =
      getFields({
        fields,
        allowFieldFive
      });

    const slots =
      buildTimeSlots({
        startTime,
        endTime,
        durationMinutes,
        toleranceMinutes
      });

    const matches =
      await getScheduledMatches(
        tournamentId
      );

    const available = [];

    for (
      const slot of slots
    ) {
      for (
        const field of
          validFields
      ) {
        const candidate =
          {
            match_date:
              normalizedDate,

            match_time:
              slot.start,

            field_name:
              field,

            home_team_id:
              null,

            away_team_id:
              null
          };

        if (
          hasFieldConflict(
            candidate,
            matches
          )
        ) {
          continue;
        }

        available.push({
          date:
            normalizedDate,

          time:
            slot.start,

          endTime:
            slot.end,

          field
        });
      }
    }

    return available;
  }

  window.GOF =
    window.GOF || {};

  window.GOF.schedule = {
    DEFAULT_FIELDS,
    ADMIN_FIELDS,

    DEFAULT_GAME_MINUTES,
    DEFAULT_TOLERANCE_MINUTES,

    buildTimeSlots,
    normalizeFieldName,
    getFields,

    hasTeamConflict,
    hasFieldConflict,

    getScheduledMatches,

    generateTournamentSchedule,

    validateTournamentSchedule,

    getAvailableSlots,

    updateMatchSchedule
  };
})();
