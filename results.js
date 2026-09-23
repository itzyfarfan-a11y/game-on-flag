/* GAME ON FLAG — Resultados */
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

  function validateScore(score, label) {
    if (
      score === null ||
      score === undefined ||
      score === ""
    ) {
      throw new Error(
        `Falta el marcador de ${label}.`
      );
    }

    const
