/* GAME ON FLAG — autenticación */
(function () {
  "use strict";

  let client = null;
  let initialized = false;

  async function getClient() {
    if (client) {
      return client;
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      throw new Error(
        "Supabase JS no está cargado."
      );
    }

    const cfg = window.GOF_CONFIG || {};

    if (
      !cfg.supabaseUrl ||
      !cfg.supabaseAnonKey ||
      cfg.supabaseUrl.includes("YOUR-") ||
      cfg.supabaseAnonKey.includes("YOUR_") ||
      !cfg.supabaseAnonKey.startsWith("sb_publishable_")
    ) {
      throw new Error(
        "La configuración pública de Supabase no es válida."
      );
    }

    client = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabaseAnonKey
    );

    window.GOF = window.GOF || {};
    window.GOF.supabase = client;

    return client;
  }

  async function signIn(
    email,
    password
  ) {
    const sb = await getClient();

    const { data, error } =
      await sb.auth.signInWithPassword({
        email: String(
          email || ""
        ).trim(),
        password: String(
          password || ""
        )
      });

    if (error) {
      throw error;
    }

    return data;
  }

  async function signUp(
    email,
    password,
    fullName
  ) {
    const sb = await getClient();

    const { data, error } =
      await sb.auth.signUp({
        email: String(
          email || ""
        ).trim(),
        password: String(
          password || ""
        ),
        options: {
          data: {
            full_name: String(
              fullName || ""
            ).trim()
          }
        }
      });

    if (error) {
      throw error;
    }

    return data;
  }

  async function signOut() {
    const sb = await getClient();

    const { error } =
      await sb.auth.signOut();

    if (error) {
      throw error;
    }

    if (window.GOF) {
      window.GOF.session = null;
      window.GOF.user = null;
      window.GOF.context =
        window.GOF.context || {};

      window.GOF.context.activeLeague =
        null;

      window.GOF.context.activeTournament =
        null;
    }
  }

  async function getSession() {
    const sb = await getClient();

    const { data, error } =
      await sb.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  }

  async function getUser() {
    const sb = await getClient();

    const { data, error } =
      await sb.auth.getUser();

    if (error) {
      throw error;
    }

    return data.user;
  }

  async function init() {
    if (initialized) {
      return {
        session:
          window.GOF?.session || null,
        user:
          window.GOF?.user || null
      };
    }

    const sb = await getClient();

    const {
      data: {
        session
      },
      error
    } = await sb.auth.getSession();

    if (error) {
      throw error;
    }

    window.GOF =
      window.GOF || {};

    window.GOF.session =
      session || null;

    window.GOF.user =
      session?.user || null;

    window.GOF.context =
      window.GOF.context || {};

    /*
     * No inventamos una liga.
     * La liga activa será cargada por
     * el módulo correspondiente.
     */
    if (
      !window.GOF.context.activeLeague
    ) {
      window.GOF.context.activeLeague =
        null;
    }

    if (
      !window.GOF.context.activeTournament
    ) {
      window.GOF.context.activeTournament =
        null;
    }

    sb.auth.onAuthStateChange(
      function (
        _event,
        newSession
      ) {
        window.GOF =
          window.GOF || {};

        window.GOF.session =
          newSession || null;

        window.GOF.user =
          newSession?.user || null;
      }
    );

    initialized = true;

    return {
      session:
        session || null,
      user:
        session?.user || null
    };
  }

  /*
   * Alias utilizados por el
   * orquestador principal.
   */
  async function logout() {
    return signOut();
  }

  window.GOF =
    window.GOF || {};

  window.GOF.auth = {
    getClient,
    init,
    signIn,
    signUp,
    signOut,
    logout,
    getSession,
    getUser
  };

})();
