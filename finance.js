/* GAME ON FLAG — Contabilidad */
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

  function requireId(id, message) {
    if (!id) {
      throw new Error(message);
    }

    return id;
  }

  function money(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat(
      "es-MX",
      {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2
      }
    ).format(number);
  }

  function number(value) {
    const result = Number(value);

    if (
      !Number.isFinite(result) ||
      result < 0
    ) {
      throw new Error(
        "El importe debe ser un número válido mayor o igual a cero."
      );
    }

    return result;
  }

  async function verifyAdminAccess() {
    requireLeague();

    if (
      !window.GOF.auth ||
      typeof window.GOF.auth.isAdmin !== "function"
    ) {
      throw new Error(
        "El módulo de autenticación no está cargado."
      );
    }

    const allowed =
      await window.GOF.auth.isAdmin();

    if (!allowed) {
      throw new Error(
        "Solo un administrador puede acceder a Contabilidad."
      );
    }

    return true;
  }

  async function getTournaments() {
    const league = requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("tournaments")
      .select(`
        id,
        name,
        status,
        league_id,
        start_date,
        end_date
      `)
      .eq(
        "league_id",
        league.id
      )
      .order(
        "start_date",
        {
          ascending: false,
          nullsFirst: false
        }
      );

    if (error) throw error;

    return data || [];
  }

  async function getTournamentTeams(
    tournamentId
  ) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

    const league = requireLeague();

    const {
      data,
      error
    } = await sb()
      .from("tournament_teams")
      .select(`
        id,
        tournament_id,
        team_id,
        category_id,
        active,
        teams (
          id,
          name,
          league_id
        ),
        categories (
          id,
          name,
          league_id
        )
      `)
      .eq(
        "tournament_id",
        tournamentId
      )
      .eq(
        "active",
        true
      );

    if (error) throw error;

    return (data || [])
      .filter(row =>
        row.teams?.league_id === league.id &&
        row.categories?.league_id === league.id
      );
  }

  async function getCharges(
    tournamentId
  ) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

    const teams =
      await getTournamentTeams(
        tournamentId
      );

    const allowed =
      new Set(
        teams.map(
          team =>
            team.id
        )
      );

    const {
      data,
      error
    } = await sb()
      .from("finance_charges")
      .select(`
        id,
        tournament_id,
        tournament_team_id,
        concept_type,
        round_number,
        playoff_stage,
        description,
        amount_due,
        created_at
      `)
      .eq(
        "tournament_id",
        tournamentId
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

    if (error) throw error;

    return (data || [])
      .filter(row =>
        allowed.has(
          row.tournament_team_id
        )
      );
  }

  async function getPayments(
    tournamentId
  ) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

    const charges =
      await getCharges(
        tournamentId
      );

    const chargeIds =
      charges.map(
        charge =>
          charge.id
      );

    if (
      chargeIds.length === 0
    ) {
      return [];
    }

    const {
      data,
      error
    } = await sb()
      .from("finance_payments")
      .select(`
        id,
        charge_id,
        amount,
        paid_at,
        note,
        created_by,
        created_at
      `)
      .in(
        "charge_id",
        chargeIds
      )
      .order(
        "paid_at",
        {
          ascending: true
        }
      );

    if (error) throw error;

    return data || [];
  }

  async function getOtherExpenses(
    tournamentId
  ) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from("finance_other_expenses")
      .select(`
        id,
        tournament_id,
        round_number,
        scope,
        playoff_stage,
        concept,
        amount,
        expense_date,
        note,
        created_at,
        created_by
      `)
      .eq(
        "tournament_id",
        tournamentId
      )
      .order(
        "expense_date",
        {
          ascending: true,
          nullsFirst: true
        }
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

    if (error) throw error;

    return data || [];
  }

  async function getOperationSettings(
    tournamentId
  ) {
    requireId(
      tournamentId,
      "Torneo no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from(
        "finance_operation_settings"
      )
      .select(`
        id,
        tournament_id,
        round_number,
        scope,
        playoff_stage,
        referee_rate,
        field_rate,
        photographer_rate,
        paramedic_rate,
        notes,
        updated_at
      `)
      .eq(
        "tournament_id",
        tournamentId
      )
      .order(
        "round_number",
        {
          ascending: true,
          nullsFirst: true
        }
      );

    if (error) throw error;

    return data || [];
  }

  async function createCharge({
    tournamentId,
    tournamentTeamId,
    conceptType,
    roundNumber = null,
    playoffStage = null,
    description = null,
    amountDue
  }) {
    await verifyAdminAccess();

    requireId(
      tournamentId,
      "Torneo no válido."
    );

    requireId(
      tournamentTeamId,
      "Equipo del torneo no válido."
    );

    const amount =
      number(amountDue);

    if (!conceptType) {
      throw new Error(
        "Falta el tipo de concepto."
      );
    }

    const {
      data,
      error
    } = await sb()
      .from("finance_charges")
      .insert({
        tournament_id:
          tournamentId,
        tournament_team_id:
          tournamentTeamId,
        concept_type:
          conceptType,
        round_number:
          roundNumber,
        playoff_stage:
          playoffStage,
        description:
          description || null,
        amount_due:
          amount
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function registerPayment({
    chargeId,
    amount,
    paidAt = null,
    note = null
  }) {
    await verifyAdminAccess();

    requireId(
      chargeId,
      "Cargo no válido."
    );

    const paymentAmount =
      Number(amount);

    if (
      !Number.isFinite(
        paymentAmount
      ) ||
      paymentAmount <= 0
    ) {
      throw new Error(
        "El pago debe ser mayor a cero."
      );
    }

    const {
      data,
      error
    } = await sb()
      .from(
        "finance_payments"
      )
      .insert({
        charge_id:
          chargeId,
        amount:
          paymentAmount,
        paid_at:
          paidAt ||
          new Date().toISOString(),
        note:
          note || null
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function deletePayment(
    paymentId
  ) {
    await verifyAdminAccess();

    requireId(
      paymentId,
      "Pago no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from(
        "finance_payments"
      )
      .delete()
      .eq(
        "id",
        paymentId
      )
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function createExpense({
    tournamentId,
    roundNumber = null,
    scope = null,
    playoffStage = null,
    concept,
    amount,
    expenseDate = null,
    note = null
  }) {
    await verifyAdminAccess();

    requireId(
      tournamentId,
      "Torneo no válido."
    );

    if (
      !concept ||
      !String(concept).trim()
    ) {
      throw new Error(
        "Falta el concepto del gasto."
      );
    }

    const expenseAmount =
      number(amount);

    const {
      data,
      error
    } = await sb()
      .from(
        "finance_other_expenses"
      )
      .insert({
        tournament_id:
          tournamentId,
        round_number:
          roundNumber,
        scope:
          scope || null,
        playoff_stage:
          playoffStage || null,
        concept:
          String(concept).trim(),
        amount:
          expenseAmount,
        expense_date:
          expenseDate ||
          new Date()
            .toISOString()
            .slice(0, 10),
        note:
          note || null
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function deleteExpense(
    expenseId
  ) {
    await verifyAdminAccess();

    requireId(
      expenseId,
      "Gasto no válido."
    );

    const {
      data,
      error
    } = await sb()
      .from(
        "finance_other_expenses"
      )
      .delete()
      .eq(
        "id",
        expenseId
      )
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async function saveOperationSettings({
    tournamentId,
    roundNumber = null,
    scope,
    playoffStage = null,
    refereeRate = 0,
    fieldRate = 0,
    photographerRate = 0,
    paramedicRate = 0,
    notes = null
  }) {
    await verifyAdminAccess();

    requireId(
      tournamentId,
      "Torneo no válido."
    );

    if (!scope) {
      throw new Error(
        "Falta el alcance de la operación."
      );
    }

    const payload = {
      tournament_id:
        tournamentId,
      round_number:
        roundNumber,
      scope,
      playoff_stage:
        playoffStage,
      referee_rate:
        number(refereeRate),
      field_rate:
        number(fieldRate),
      photographer_rate:
        number(photographerRate),
      paramedic_rate:
        number(paramedicRate),
      notes:
        notes || null
    };

    const {
      data,
      error
    } = await sb()
      .from(
        "finance_operation_settings"
      )
      .upsert(
        payload,
        {
          onConflict:
            "tournament_id,scope,round_number,playoff_stage"
        }
      )
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  function calculateTeamBalances(
    teams,
    charges,
    payments
  ) {
    const paymentByCharge =
      new Map();

    (payments || []).forEach(
      payment => {
        const current =
          paymentByCharge.get(
            payment.charge_id
          ) || 0;

        paymentByCharge.set(
          payment.charge_id,
          current +
            Number(
              payment.amount || 0
            )
        );
      }
    );

    const result =
      new Map();

    (teams || []).forEach(
      team => {
        result.set(
          team.id,
          {
            tournamentTeamId:
              team.id,
            teamId:
              team.team_id,
            teamName:
              team.teams?.name ||
              "SIN NOMBRE",
            categoryName:
              team.categories?.name ||
              "",
            due: 0,
            paid: 0,
            balance: 0
          }
        );
      }
    );

    (charges || []).forEach(
      charge => {
        const row =
          result.get(
            charge.tournament_team_id
          );

        if (!row) return;

        const due =
          Number(
            charge.amount_due || 0
          );

        const paid =
          Number(
            paymentByCharge.get(
              charge.id
            ) || 0
          );

        row.due += due;
        row.paid += paid;
      }
    );

    result.forEach(
      row => {
        row.balance =
          Math.max(
            0,
            row.due -
              row.paid
          );
      }
    );

    return Array.from(
      result.values()
    );
  }

  function getPaymentStatus(
    due,
    paid
  ) {
    const total =
      Number(due || 0);

    const received =
      Number(paid || 0);

    if (
      received >= total &&
      total > 0
    ) {
      return "pagado";
    }

    if (
      received > 0 &&
      received < total
    ) {
      return "parcial";
    }

    if (
      total > 0 &&
      received <= 0
    ) {
      return "pendiente";
    }

    return "sin_cargo";
  }

  function getTrafficLight(
    due,
    paid
  ) {
    const status =
      getPaymentStatus(
        due,
        paid
      );

    if (
      status === "pagado"
    ) {
      return "green";
    }

    if (
      status === "parcial"
    ) {
      return "yellow";
    }

    if (
      status === "pendiente"
    ) {
      return "red";
    }

    return "gray";
  }

  function calculateSummary({
    charges = [],
    payments = [],
    expenses = []
  }) {
    const totalDue =
      charges.reduce(
        (sum, charge) =>
          sum +
          Number(
            charge.amount_due || 0
          ),
        0
      );

    const totalPaid =
      payments.reduce(
        (sum, payment) =>
          sum +
          Number(
            payment.amount || 0
          ),
        0
      );

    const totalExpenses =
      expenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount || 0
          ),
        0
      );

    return {
      totalDue,
      totalPaid,
      totalExpenses,
      outstanding:
        Math.max(
          0,
          totalDue -
            totalPaid
        ),
      net:
        totalPaid -
        totalExpenses
    };
  }

  async function getDashboard(
    tournamentId
  ) {
    await verifyAdminAccess();

    const [
      teams,
      charges,
      payments,
      expenses,
      settings
    ] = await Promise.all([
      getTournamentTeams(
        tournamentId
      ),
      getCharges(
        tournamentId
      ),
      getPayments(
        tournamentId
      ),
      getOtherExpenses(
        tournamentId
      ),
      getOperationSettings(
        tournamentId
      )
    ]);

    const balances =
      calculateTeamBalances(
        teams,
        charges,
        payments
      );

    const summary =
      calculateSummary({
        charges,
        payments,
        expenses
      });

    return {
      teams,
      charges,
      payments,
      expenses,
      settings,
      balances,
      summary
    };
  }

  function renderTrafficLight(
    container,
    status
  ) {
    if (!container) {
      return;
    }

    container.className =
      "gof-payment-light";

    container.dataset.status =
      status;

    container.innerHTML = `
      <span class="gof-payment-dot"></span>
      <span class="gof-payment-status">
        ${status === "pagado"
          ? "Pagado"
          : status === "parcial"
            ? "Parcial"
            : status === "pendiente"
              ? "Pendiente"
              : "Sin cargo"}
      </span>
    `;
  }

  function renderSummary(
    container,
    summary
  ) {
    if (!container) {
      return;
    }

    const data =
      summary || {};

    container.innerHTML = `
      <div class="gof-finance-card">
        <small>Por cobrar</small>
        <strong>
          ${money(
            data.totalDue || 0
          )}
        </strong>
      </div>

      <div class="gof-finance-card">
        <small>Cobrado</small>
        <strong>
          ${money(
            data.totalPaid || 0
          )}
        </strong>
      </div>

      <div class="gof-finance-card">
        <small>Gastos</small>
        <strong>
          ${money(
            data.totalExpenses || 0
          )}
        </strong>
      </div>

      <div class="gof-finance-card">
        <small>Saldo pendiente</small>
        <strong>
          ${money(
            data.outstanding || 0
          )}
        </strong>
      </div>

      <div class="gof-finance-card">
        <small>Neto</small>
        <strong>
          ${money(
            data.net || 0
          )}
        </strong>
      </div>
    `;
  }

  window.GOF =
    window.GOF || {};

  window.GOF.finance = {
    money,
    getTournaments,
    getTournamentTeams,
    getCharges,
    getPayments,
    getOtherExpenses,
    getOperationSettings,
    createCharge,
    registerPayment,
    deletePayment,
    createExpense,
    deleteExpense,
    saveOperationSettings,
    calculateTeamBalances,
    getPaymentStatus,
    getTrafficLight,
    calculateSummary,
    getDashboard,
    renderTrafficLight,
    renderSummary
  };
})();
