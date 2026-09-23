/* GAME ON FLAG — Calendario */
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

  function normalizeTime(value) {
    if (!value) return null;

    const text = String(value).trim();

    if (/^\d{2}:\d{2}$/.test(text)) {
      return `${text}:00`;
    }

    return text;
  }

  function normalizeDate(value) {
    if (!value) return null;

    const text = String(value).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new Error(
        "La fecha debe tener formato YYYY-MM-DD."
      );
    }

    return text;
  }

  function normalizeField(value) {
    return String(value || "").trim();
  }

  function validateTime(value) {
    if (!value) {
      throw new Error("La hora es obligatoria.");
    }

    const time = normalizeTime(value);
    const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(time);

    if (!match) {
      throw new Error("La hora no es válida.");
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      throw new Error("La hora no es válida.");
    }

    return time;
  }

  function validateField(value) {
    const field = normalizeField(value);

    if (!field) {
      throw new Error("El campo es obligatorio.");
    }

    const normalized = field
      .toLowerCase()
      .replace(/\s+/g, " ");

    const validFields = [
      "campo 1",
      "campo 2",
      "campo 3",
      "campo 4",
      "field 1",
      "field 2",
      "field 3",
      "field 4",
      "cancha 1",
      "cancha 2",
      "cancha 3",
      "cancha 4"
    ];

    if (!validFields.includes(normalized)) {
      throw new Error(
        "Solo se permiten Campo 1 a Campo 4 para la programación normal."
      );
    }

    return field;
  }

  async function listCalendar(
    tournamentId,
    options = {}
  ) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    const league = requireLeague();

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
        home_score,
        away_score,
        status,
        published,
        is_makeup,
        schedule_manual_override,
        schedule_override_note,
        schedule_override_at,
        schedule_generated_at,
        home_team:teams!matches_home_team_id_fkey (
          id,
          name,
          logo_url,
          league_id
        ),
        away_team:teams!matches_away_team_id_fkey (
          id,
          name,
          logo_url,
          league_id
        ),
        categories (
          id,
          name,
          league_id
        )
      `)
      .eq("tournament_id", tournamentId)
      .order("match_date", {
        ascending: true,
        nullsFirst: true
      })
      .order("match_time", {
        ascending: true,
        nullsFirst: true
      })
      .order("field_name", {
        ascending: true,
        nullsFirst: true
      });

    if (options.categoryId) {
      query = query.eq(
        "category_id",
        options.categoryId
      );
    }

    if (options.roundNumber) {
      query = query.eq(
        "round_number",
        Number(options.roundNumber)
      );
    }

    if (options.date) {
      query = query.eq(
        "match_date",
        normalizeDate(options.date)
      );
    }

    if (options.publishedOnly === true) {
      query = query.eq(
        "published",
        true
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).filter(match => {
      const categoryOk =
        !match.categories ||
        match.categories.league_id === league.id;

      const homeOk =
        !match.home_team ||
        match.home_team.league_id === league.id;

      const awayOk =
        !match.away_team ||
        match.away_team.league_id === league.id;

      return categoryOk && homeOk && awayOk;
    });
  }

  async function updateMatchSchedule({
