// Reads packages with everything calculated from the stored facts (docs/spec/pacotes-e-pagamentos.md).
// Balance, due date and status come from `src/domain/pacotes`; nothing derived is stored.
import type { PackageSummary, PaymentMethod, PaymentView } from '../../src/application/api-contract';
import {
  dataEmSaoPaulo,
  diasPausadosNoLimite,
  estaPausado,
  origemDasAulas,
  resumirPagamento,
  resumirPacote,
  totalDoPacoteCentavos,
  vencimentoOriginal,
  type Data,
  type DadosDoPacote,
  type Pausa,
  type ResumoDePagamento,
  type ResumoDoPacote,
} from '../../src/domain/pacotes';
import type { Context } from './context';

export interface PackageRow {
  id: string;
  holder_id: string;
  participant_id: string | null;
  plan_id: string;
  classes: number;
  price_cents: number;
  validity_days: number;
  transferred_in: number;
  used_before_app: number;
  first_class_on: string | null;
  previous_package_id: string | null;
  created_on: string;
  closed_at: string | null;
  closed_note: string | null;
}

export interface PaymentRow {
  id: string;
  package_id: string;
  paid_on: string;
  amount_cents: number;
  method: PaymentMethod;
}

export interface PauseRow {
  id: string;
  package_id: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
}

export interface GlobalPauseRow {
  id: string;
  starts_on: string;
  ends_on: string;
}

/** A package with its calculated state. */
export interface PackageState {
  readonly row: PackageRow;
  readonly dados: DadosDoPacote;
  readonly resumo: ResumoDoPacote;
  readonly pagamento: ResumoDePagamento;
  readonly pausas: readonly Pausa[];
  readonly payments: readonly PaymentRow[];
  readonly ownPauses: readonly PauseRow[];
}

export const toPausa = (row: { starts_on: string; ends_on: string; reason?: string | null }, geral: boolean): Pausa => ({
  inicio: row.starts_on,
  fim: row.ends_on,
  geral,
  motivo: row.reason ?? null,
});

export function todayIn(ctx: Context): Data {
  return dataEmSaoPaulo(ctx.clock.now());
}

export function loadGlobalPauses(ctx: Context): GlobalPauseRow[] {
  return ctx.sql.all<GlobalPauseRow>('SELECT id, starts_on, ends_on FROM global_pauses ORDER BY starts_on, rowid');
}

interface ConsumptionRow {
  package_id: string;
  class_id: string;
  status: 'given' | 'missed';
  starts_at: string;
}

/**
 * Every package, calculated as of `today`. The data is small (one trainer), so everything is read
 * in a few bulk queries and put together here.
 */
export function loadPackages(ctx: Context, today: Data): Map<string, PackageState> {
  const rows = ctx.sql.all<PackageRow>('SELECT * FROM packages ORDER BY rowid');
  const globals = loadGlobalPauses(ctx).map((pause) => toPausa(pause, true));
  const ownPauses = ctx.sql.all<PauseRow>('SELECT * FROM package_pauses ORDER BY starts_on, rowid');
  const payments = ctx.sql.all<PaymentRow>('SELECT * FROM payments ORDER BY paid_on, rowid');
  // A pair lesson has two rows on the same package: count each lesson once.
  const consumption = ctx.sql.all<ConsumptionRow>(
    `SELECT DISTINCT cs.package_id, c.id AS class_id, c.status, c.starts_at
       FROM class_students cs JOIN classes c ON c.id = cs.class_id
      WHERE cs.charge = 'consumes' AND cs.package_id IS NOT NULL`,
  );
  const states = new Map<string, PackageState>();
  for (const row of rows) {
    const mine = consumption.filter((c) => c.package_id === row.id);
    const own = ownPauses.filter((p) => p.package_id === row.id);
    const dates = mine.map((c) => dataEmSaoPaulo(c.starts_at));
    if (row.first_class_on) dates.push(row.first_class_on);
    const primeiraAula = dates.length > 0 ? dates.reduce((a, b) => (a <= b ? a : b)) : null;
    const pausas = [...own.map((p) => toPausa(p, false)), ...globals];
    const dados: DadosDoPacote = {
      totalAulas: row.classes,
      aulasTransferidas: row.transferred_in,
      usadasAntesDoApp: row.used_before_app,
      aulasDadas: mine.filter((c) => c.status === 'given').length,
      faltasCobradas: mine.filter((c) => c.status === 'missed').length,
      validadeDias: row.validity_days,
      primeiraAula,
      pausas,
      encerrado: row.closed_at !== null,
    };
    const mineP = payments.filter((p) => p.package_id === row.id);
    states.set(row.id, {
      row,
      dados,
      resumo: resumirPacote(dados, today),
      pagamento: resumirPagamento(
        totalDoPacoteCentavos(row.classes, row.price_cents),
        mineP.map((p) => ({ valorCentavos: p.amount_cents })),
      ),
      pausas,
      payments: mineP,
      ownPauses: own,
    });
  }
  return states;
}

export function studentNames(ctx: Context): Map<string, string> {
  return new Map(ctx.sql.all<{ id: string; name: string }>('SELECT id, name FROM students').map((s) => [s.id, s.name]));
}

export function toPaymentView(row: PaymentRow): PaymentView {
  return { id: row.id, packageId: row.package_id, paidOn: row.paid_on, amountCents: row.amount_cents, method: row.method };
}

export function summarize(ctx: Context, state: PackageState, names: Map<string, string>, today: Data): PackageSummary {
  const { row, resumo, pagamento, dados } = state;
  const plan = ctx.sql.all<{ name: string }>('SELECT name FROM plans WHERE id = ?', row.plan_id)[0];
  return {
    id: row.id,
    holderId: row.holder_id,
    holderName: names.get(row.holder_id) ?? '',
    participantId: row.participant_id,
    participantName: row.participant_id ? (names.get(row.participant_id) ?? '') : null,
    planId: row.plan_id,
    planName: plan?.name ?? '',
    classes: row.classes,
    priceCents: row.price_cents,
    validityDays: row.validity_days,
    totalCents: totalDoPacoteCentavos(row.classes, row.price_cents),
    transferredIn: row.transferred_in,
    usedBeforeApp: row.used_before_app,
    total: resumo.total,
    used: resumo.usadas,
    remaining: resumo.restantes,
    status: resumo.situacao,
    firstClassOn: dados.primeiraAula,
    dueOn: resumo.vencimento,
    originalDueOn: vencimentoOriginal(dados.primeiraAula, row.validity_days),
    pausedToday: estaPausado(state.pausas, today),
    pausedDaysInLimit: diasPausadosNoLimite(state.pausas),
    paymentStatus: pagamento.situacao === 'pago' ? 'paid' : 'pending',
    paidCents: pagamento.pagoCentavos,
    missingCents: pagamento.faltaCentavos,
    createdOn: row.created_on,
    origin: origemDasAulas(row.classes, row.transferred_in),
    closedNote: row.closed_note,
  };
}

/** The package a holder has open now (newest first if the data ever had two). */
export function livePackageOf(states: Map<string, PackageState>, holderId: string): PackageState | null {
  const live = [...states.values()].filter((s) => s.row.holder_id === holderId && s.row.closed_at === null);
  return live.length > 0 ? live[live.length - 1]! : null;
}
