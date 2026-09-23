/* GAME ON FLAG — autenticación */
(function () {
  "use strict";

  let client = null;

  async function getClient() {
    if (client) return client;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase JS no está cargado.");
    }

    const cfg = window.GOF_CONFIG || {};

    if (
      !cfg.supabaseUrl ||
      !cfg.supabaseAnonKey ||
      cfg.supabaseUrl.includes("YOUR-") ||
      cfg.supabaseAnonKey.includes("YOUR_")
    ) {
      throw new Error(
        "Configura supabaseUrl y supabaseAnonKey en config.js."
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

  async function signIn(email, password) {
    const sb = await getClient();

    const { data, error } = await sb.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    });

    if (error) throw error;

    return data;
  }

  async function signUp(email, password, fullName) {
    const sb = await getClient();

    const { data, error } = await sb.auth.signUp({
      email: String(email || "").trim(),
      password: String(password || ""),
      options: {
        data: {
          full_name: String(fullName || "").trim()
        }
      }
    });

    if (error) throw error;

    return data;
  }

  async function signOut() {
    const sb = await getClient();

    const { error } = await sb.auth.signOut();

    if (error) throw error;
  }

  async function getSession() {
    const sb = await getClient();

    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    return data.session;
  }

  async function getUser() {
    const sb = await getClient();

    const { data, error } = await sb.auth.getUser();

    if (error) throw error;

    return data.user;
  }

  window.GOF = window.GOF || {};

  window.GOF.auth = {
    getClient,
    signIn,
    signUp,
    signOut,
    getSession,
    getUser
  };
})();
