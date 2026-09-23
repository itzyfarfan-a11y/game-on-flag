/* GAME ON FLAG — Credenciales imprimibles */
(function () {
  "use strict";

  function requireContext() {
    const context = window.GOF && window.GOF.context;

    if (!context || !context.activeLeague) {
      throw new Error("No hay una liga activa.");
    }

    return context;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizePlayer(player) {
    const source = player.players || player;

    return {
      id: source.id || player.player_id || "",
      full_name: source.full_name || "",
      photo_url: source.photo_url || "",
      jersey_number:
        source.jersey_number !== null &&
        source.jersey_number !== undefined
          ? source.jersey_number
          : "",
      date_of_birth: source.date_of_birth || "",
      curp: source.curp || ""
    };
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function buildCredentialCard({
    league,
    tournament,
    category,
    team,
    player
  }) {
    const logoGameOnFlag =
      "assets/game-on-flag-logo.png";

    const leagueLogo =
      league.logo_url || "";

    return `
      <article class="gof-credential">
        <div class="gof-credential-header">
          <img
            class="gof-credential-logo"
            src="${escapeHtml(logoGameOnFlag)}"
            alt="GAME ON FLAG"
          >

          ${
            leagueLogo
              ? `
                <img
                  class="gof-credential-league-logo"
                  src="${escapeHtml(leagueLogo)}"
                  alt="${escapeHtml(league.name)}"
                >
              `
              : ""
          }
        </div>

        <div class="gof-credential-title">
          CREDENCIAL DE JUGADOR
        </div>

        <div class="gof-credential-photo">
          ${
            player.photo_url
              ? `
                <img
                  src="${escapeHtml(player.photo_url)}"
                  alt="${escapeHtml(player.full_name)}"
                >
              `
              : `
                <div class="gof-credential-no-photo">
                  SIN FOTO
                </div>
              `
          }
        </div>

        <div class="gof-credential-number">
          ${escapeHtml(player.jersey_number)}
        </div>

        <div class="gof-credential-name">
          ${escapeHtml(player.full_name)}
        </div>

        <div class="gof-credential-data">
          <div>
            <strong>LIGA</strong>
            <span>${escapeHtml(league.name)}</span>
          </div>

          <div>
            <strong>TORNEO</strong>
            <span>${escapeHtml(tournament.name)}</span>
          </div>

          <div>
            <strong>CATEGORÍA</strong>
            <span>${escapeHtml(category.name)}</span>
          </div>

          <div>
            <strong>EQUIPO</strong>
            <span>${escapeHtml(team.name)}</span>
          </div>

          ${
            player.date_of_birth
              ? `
                <div>
                  <strong>FECHA DE NACIMIENTO</strong>
                  <span>${escapeHtml(
                    formatDate(player.date_of_birth)
                  )}</span>
                </div>
              `
              : ""
          }

          ${
            player.curp
              ? `
                <div>
                  <strong>CURP</strong>
                  <span>${escapeHtml(player.curp)}</span>
                </div>
              `
              : ""
          }
        </div>

        <div class="gof-credential-footer">
          GAME ON FLAG
        </div>
      </article>
    `;
  }

  function buildPrintDocument({
    league,
    tournament,
    category,
    team,
    players
  }) {
    const cards = players
      .map(player =>
        buildCredentialCard({
          league,
          tournament,
          category,
          team,
          player: normalizePlayer(player)
        })
      )
      .join("");

    return `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        >
        <title>
          Credenciales - ${escapeHtml(team.name)}
        </title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 20px;
            background: #eee;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
          }

          .gof-credentials-sheet {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 12px;
            max-width: 900px;
            margin: 0 auto;
          }

          .gof-credential {
            position: relative;
            background: #fff;
            border: 2px solid #111;
            border-radius: 12px;
            padding: 12px;
            min-height: 360px;
            overflow: hidden;
          }

          .gof-credential-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-height: 48px;
          }

          .gof-credential-logo {
            width: 115px;
            max-height: 42px;
            object-fit: contain;
          }

          .gof-credential-league-logo {
            width: 55px;
            height: 55px;
            object-fit: contain;
          }

          .gof-credential-title {
            margin-top: 8px;
            font-size: 13px;
            font-weight: 800;
            text-align: center;
          }

          .gof-credential-photo {
            width: 115px;
            height: 135px;
            margin: 10px auto 4px;
            border: 1px solid #aaa;
            overflow: hidden;
            background: #eee;
          }

          .gof-credential-photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .gof-credential-no-photo {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            font-size: 11px;
            color: #666;
          }

          .gof-credential-number {
            text-align: center;
            font-size: 22px;
            font-weight: 900;
          }

          .gof-credential-name {
            margin: 4px 0 8px;
            text-align: center;
            font-size: 16px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .gof-credential-data {
            display: grid;
            gap: 4px;
            font-size: 9px;
          }

          .gof-credential-data div {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 3px;
          }

          .gof-credential-data strong {
            font-size: 8px;
          }

          .gof-credential-data span {
            text-align: right;
          }

          .gof-credential-footer {
            position: absolute;
            left: 12px;
            right: 12px;
            bottom: 7px;
            text-align: center;
            font-size: 8px;
            font-weight: 800;
          }

          @media print {
            body {
              background: #fff;
              padding: 0;
            }

            .gof-credentials-sheet {
              max-width: none;
            }

            .gof-credential {
              break-inside: avoid;
            }
          }

          @media (max-width: 650px) {
            .gof-credentials-sheet {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>

      <body>
        <main class="gof-credentials-sheet">
          ${cards}
        </main>

        <script>
          window.addEventListener("load", function () {
            setTimeout(function () {
              window.print();
            }, 300);
          });
        <\/script>
      </body
