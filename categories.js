/* GAME ON FLAG — Categorías */
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

  async function listCategories() {
    const league = requireLeague();

    const { data, error } = await sb()
      .from("categories")
      .select("id,name,league_id")
      .eq("league_id", league.id)
      .order("name", { ascending: true });

    if (error) throw error;

    return data || [];
  }

  async function getCategory(categoryId) {
    if (!categoryId) {
      throw new Error("Categoría no válida.");
    }

    const league = requireLeague();

    const { data, error } = await sb()
      .from("categories")
      .select("id,name,league_id")
      .eq("id", categoryId)
      .eq("league_id", league.id)
      .maybeSingle();

    if (error) throw error;

    return data || null;
  }

  async function createCategory(name) {
    const league = requireLeague();

    const cleanName = String(name || "").trim();

    if (!cleanName) {
      throw new Error("El nombre de la categoría es obligatorio.");
    }

    const { data, error } = await sb()
      .from("categories")
      .insert({
        name: cleanName,
        league_id: league.id
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function updateCategory(categoryId, name) {
    if (!categoryId) {
      throw new Error("Categoría no válida.");
    }

    const league = requireLeague();

    const cleanName = String(name || "").trim();

    if (!cleanName) {
      throw new Error("El nombre de la categoría es obligatorio.");
    }

    const { data, error } = await sb()
      .from("categories")
      .update({
        name: cleanName
      })
      .eq("id", categoryId)
      .eq("league_id", league.id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function deleteCategory(categoryId) {
    if (!categoryId) {
      throw new Error("Categoría no válida.");
    }

    const league = requireLeague();

    const { data: tournamentCategories, error: tcError } =
      await sb()
        .from("tournament_categories")
        .select("id")
        .eq("category_id", categoryId)
        .limit(1);

    if (tcError) throw tcError;

    if (tournamentCategories && tournamentCategories.length) {
      throw new Error(
        "No se puede eliminar una categoría que ya está registrada en un torneo."
      );
    }

    const { error } = await sb()
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("league_id", league.id);

    if (error) throw error;

    return true;
  }

  async function registerCategoryInTournament(
    tournamentId,
    categoryId
  ) {
    if (!tournamentId || !categoryId) {
      throw new Error("Torneo o categoría no válidos.");
    }

    const league = requireLeague();

    const { data: tournament, error: tournamentError } =
      await sb()
        .from("tournaments")
        .select("id,league_id")
        .eq("id", tournamentId)
        .eq("league_id", league.id)
        .maybeSingle();

    if (tournamentError) throw tournamentError;

    if (!tournament) {
      throw new Error("El torneo no pertenece a la liga activa.");
    }

    const { data: category, error: categoryError } =
      await sb()
        .from("categories")
        .select("id,league_id")
        .eq("id", categoryId)
        .eq("league_id", league.id)
        .maybeSingle();

    if (categoryError) throw categoryError;

    if (!category) {
      throw new Error("La categoría no pertenece a la liga activa.");
    }

    const { data, error } = await sb()
      .from("tournament_categories")
      .insert({
        tournament_id: tournamentId,
        category_id: categoryId
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function listTournamentCategories(tournamentId) {
    if (!tournamentId) {
      throw new Error("Torneo no válido.");
    }

    const league = requireLeague();

    const { data, error } = await sb()
      .from("tournament_categories")
      .select(`
        id,
        tournament_id,
        category_id,
        categories (
          id,
          name,
          league_id
        )
      `)
      .eq("tournament_id", tournamentId);

    if (error) throw error;

    return (data || []).filter(
      row =>
        row.categories &&
        row.categories.league_id === league.id
    );
  }

  async function removeCategoryFromTournament(
    registrationId
  ) {
    if (!registrationId) {
      throw new Error("Registro de categoría no válido.");
    }

    const { error } = await sb()
      .from("tournament_categories")
      .delete()
      .eq("id", registrationId);

    if (error) throw error;

    return true;
  }

  window.GOF = window.GOF || {};

  window.GOF.categories = {
    listCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    registerCategoryInTournament,
    listTournamentCategories,
    removeCategoryFromTournament
  };
})();
