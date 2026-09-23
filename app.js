(function () {
  "use strict";

  const config = window.GOF_CONFIG || {};

  document.addEventListener("DOMContentLoaded", function () {
    const name = document.getElementById("app-name");

    if (name) {
      name.textContent = config.appName || "GAME ON FLAG";
    }

    const status = document.getElementById("app-status");

    if (status) {
      const ready =
        typeof config.supabaseUrl === "string" &&
        config.supabaseUrl.includes("supabase.co") &&
        typeof config.supabaseAnonKey === "string" &&
        !config.supabaseAnonKey.startsWith("YOUR_");

      status.textContent = ready
        ? "Configuración lista"
        : "Configuración de Supabase pendiente";
    }
  });
})();
