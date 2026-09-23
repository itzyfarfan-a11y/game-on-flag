/* GAME ON FLAG — Integración principal */
(function () {
  "use strict";

  window.GOF = window.GOF || {};

  const GOF = window.GOF;

  GOF.ui = GOF.ui || {};
  GOF.context = GOF.context || {
    activeLeague: null,
    activeTournament: null
  };


  /* =====================================================
     UTILIDADES
  ===================================================== */

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return Array.from(
      document.querySelectorAll(selector)
    );
  }

  function getSession() {
    return GOF.session || null;
  }

  function getActiveLeague() {
    return (
      GOF.context &&
      GOF.context.activeLeague
    ) || null;
  }

  function getActiveTournament() {
    return (
      GOF.context &&
      GOF.context.activeTournament
    ) || null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(selector, value) {
    const element = $(selector);

    if (!element) {
      return;
    }

    element.textContent =
      value ?? "";
  }


  /* =====================================================
     LOADING / ERRORES
  ===================================================== */

  function showLoading(
    message = "Cargando..."
  ) {
    const element =
      $("#app-loading");

    if (!element) {
      return;
    }

    element.textContent =
      message;

    element.hidden = false;
  }

  function hideLoading() {
    const element =
      $("#app-loading");

    if (!element) {
      return;
    }

    element.hidden = true;
  }

  function showError(
    error,
    container = null
  ) {
    const message =
      error?.message ||
      String(error) ||
      "Ocurrió un error.";

    const target =
      container ||
      $("#app-error");

    if (!target) {
      console.error(
        "GAME ON FLAG:",
        error
      );
      return;
    }

    target.textContent =
      message;

    target.hidden = false;

    console.error(
      "GAME ON FLAG:",
      error
    );
  }

  function clearError(
    container = null
  ) {
    const target =
      container ||
      $("#app-error");

    if (!target) {
      return;
    }

    target.textContent = "";
    target.hidden = true;
  }


  /* =====================================================
     VISTAS
  ===================================================== */

  function showView(
    viewName
  ) {
    $$(
      "[data-gof-view]"
    ).forEach(view => {
      view.hidden =
        view.dataset.gofView !==
        viewName;
    });

    $$(
      "[data-gof-nav]"
    ).forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.gofNav ===
          viewName
      );
    });

    /*
     * El login y la aplicación son
     * contenedores independientes.
     *
     * Cuando se muestra login
