/* GAME ON FLAG — Configuración principal */
(function () {
  "use strict";

  /*
   * IMPORTANTE:
   *
   * Aquí solamente debe colocarse la URL pública de Supabase
   * y la clave pública ANON/PUBLISHABLE.
   *
   * NUNCA colocar:
   * - service_role
   * - secret keys
   * - claves privadas
   */

  window.GOF_CONFIG = Object.freeze({

    appName:
      "GAME ON FLAG",

    supabaseUrl:
      "https://picivrqgmckrwutarhyw.supabase.co",

    /*
     * PENDIENTE:
     *
     * Reemplaza únicamente el valor siguiente
     * por la clave pública ANON/PUBLISHABLE
     * de tu proyecto Supabase.
     */
    supabaseAnonKey:
      "PEGA_AQUI_TU_CLAVE_PUBLICA",

    environment:
      "production"

  });

})();
