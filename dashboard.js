/* GAME ON FLAG — contexto inicial del panel */
(function () {
  "use strict";

  function showError(message) {
    const el = document.getElementById("app-error");

    if (el) {
      el.hidden = false;
      el.textContent =
        message || "Ocurrió un error.";
    }
  }

  function clearError() {
    const el = document.getElementById("app-error");

    if (el) {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function renderLeague(league) {
    const name =
      document.getElementById(
        "active-league-name"
      );

    const slug =
      document.getElementById(
        "active-league-slug"
      );

    if (name) {
      name.textContent = league
        ? league.name
        : "Sin liga activa";
    }

    if (slug) {
      slug.textContent = league
        ? league.slug
        : "";
    }
  }

  async function loadDashboard() {
    clearError();

    if (
      !window.GOF ||
      !window.GOF.auth ||
      !window.GOF.leagues
    ) {
      showError(
        "Los módulos de GAME ON FLAG no están cargados."
      );

      return null;
    }

    try {
      const session =
        await window.GOF.auth.getSession();

      if (!session) {
        renderLeague(null);

        return {
          session: null,
          league: null,
          leagues: []
        };
      }

      const leagues =
        await window.GOF.leagues.listMyLeagues();

      const active =
        leagues.find(
          item =>
            item.membership &&
            item.membership.is_current
        ) || null;

      renderLeague(active);

      window.GOF.context = {
        session,
        leagues,
        activeLeague: active
      };

      return window.GOF.context;

    } catch (error) {
      showError(
        error.message ||
        "No se pudo cargar el contexto de la liga."
      );

      throw error;
    }
  }

  window.GOF = window.GOF || {};

  window.GOF.dashboard = {
    loadDashboard,
    renderLeague
  };

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      if (
        window.GOF &&
        window.GOF.dashboard
      ) {
        window.GOF.dashboard
          .loadDashboard()
          .catch(function () {});
      }
    }
  );
})();
