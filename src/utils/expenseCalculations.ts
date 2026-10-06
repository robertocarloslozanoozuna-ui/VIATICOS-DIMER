import type { ExpenseItem, ExpenseRefund } from '../types.js';

export interface ExpenseCalculationResult {
  totalAmountPaid: number;
  totalExpenses: number;
  totalAnticipo: number;
  totalTarjetaEmpresa: number;
  totalPersonal: number;
  refundAmount: number;
  saldoAnticipoAntesReintegro: number;
  saldoPendienteDevolucion: number;
  saldoFavorColaborador: number;
  financialStatus: 'CUENTA_SALDADA' | 'SOBRANTE_PENDIENTE' | 'FAVOR_COLABORADOR';
  difference: number;
  balanceType: 'FAVOR_EMPRESA' | 'FAVOR_COLABORADOR' | 'EXACTO';
  balanceAmount: number;
  // Estructura financiera oficial DIMER
  importeDepositado: number;
  gastosComprobados: number;
  saldoNoUtilizado: number;
  importeADevolverDIMER: number;
  importeAdicionalReembolsar: number;
}

/**
 * Motor oficial de cálculo financiero para Comprobación de Gastos DIMER.
 *
 * REGLA OPERATIVA DIMER:
 * La empresa NO cuenta actualmente con tarjetas corporativas.
 * Todo el dinero comprobado corresponde al anticipo que ya fue depositado
 * por Tesorería a la tarjeta personal del colaborador.
 *
 * 1. totalExpenses = Suma de todas las partidas comprobadas por el usuario.
 * 2. totalAnticipo = Porción cubierta con el anticipo depositado (hasta el límite de totalAmountPaid).
 * 3. totalPersonal = Desembolso personal del usuario si los gastos superan el anticipo.
 * 4. totalTarjetaEmpresa = 0 (no aplican tarjetas corporativas).
 * 5. Sobrante por Devolver = Si Gastos < Anticipo, el excedente no gastado (menos ficha de reintegro).
 * 6. Saldo a Favor Colaborador = Si Gastos > Anticipo, el excedente a reembolsar por Finanzas.
 */
export function computeExpenseBalances(
  advanceAmount: number,
  items: ExpenseItem[] = [],
  refund?: ExpenseRefund | null
): ExpenseCalculationResult {
  const totalAmountPaid = Number(advanceAmount && !isNaN(advanceAmount) ? advanceAmount : 0);

  let rawTotalExpenses = 0;
  let explicitPersonal = 0;

  for (const it of items) {
    const rawAmt = Number(it.amount);
    const amt = !isNaN(rawAmt) && rawAmt > 0 ? rawAmt : 0;
    rawTotalExpenses += amt;
    if (it.paymentMethod === 'PERSONAL_REEMBOLSO') {
      explicitPersonal += amt;
    }
  }

  const totalExpenses = Number(rawTotalExpenses.toFixed(2));
  // En DIMER no existen tarjetas corporativas activas.
  const totalTarjetaEmpresa = 0;

  // Gastos cubiertos con el anticipo (hasta el límite del anticipo depositado en tarjeta personal)
  const totalAnticipo = Number(Math.min(totalExpenses, totalAmountPaid).toFixed(2));

  // Desembolso personal: gastos que superaron el anticipo otorgado
  const excedenteSobreAnticipo = Math.max(0, Number((totalExpenses - totalAmountPaid).toFixed(2)));
  const totalPersonal = Number(Math.max(excedenteSobreAnticipo, explicitPersonal).toFixed(2));

  const refundAmount = refund && typeof refund.amount === 'number' && !isNaN(refund.amount) && refund.amount > 0
    ? Number(Number(refund.amount).toFixed(2))
    : 0;

  // Saldo del anticipo antes del reintegro (sobrante de anticipo no gastado):
  const saldoAnticipoAntesReintegro = Number(Math.max(0, totalAmountPaid - totalExpenses).toFixed(2));

  // Saldo pendiente de devolución a Finanzas (remanente que el usuario debe reintegrar):
  const saldoPendienteDevolucion = Number(Math.max(0, saldoAnticipoAntesReintegro - refundAmount).toFixed(2));

  // Saldo a favor del colaborador (reembolso pendiente cuando gastó más del anticipo):
  const saldoFavorColaborador = Number(Math.max(0, totalExpenses - totalAmountPaid).toFixed(2));

  let financialStatus: 'CUENTA_SALDADA' | 'SOBRANTE_PENDIENTE' | 'FAVOR_COLABORADOR' = 'CUENTA_SALDADA';
  if (saldoPendienteDevolucion > 0) {
    financialStatus = 'SOBRANTE_PENDIENTE';
  } else if (saldoFavorColaborador > 0) {
    financialStatus = 'FAVOR_COLABORADOR';
  }

  // Compatibilidad con difference, balanceType y balanceAmount
  let difference = 0;
  if (saldoPendienteDevolucion > 0) {
    difference = saldoPendienteDevolucion;
  } else if (saldoFavorColaborador > 0) {
    difference = -saldoFavorColaborador;
  }

  const balanceType: 'FAVOR_EMPRESA' | 'FAVOR_COLABORADOR' | 'EXACTO' =
    difference > 0 ? 'FAVOR_EMPRESA' : difference < 0 ? 'FAVOR_COLABORADOR' : 'EXACTO';
  const balanceAmount = Math.abs(difference);

  const saldoNoUtilizado = saldoAnticipoAntesReintegro;
  const importeADevolverDIMER = saldoPendienteDevolucion;
  const importeAdicionalReembolsar = saldoFavorColaborador;

  return {
    totalAmountPaid,
    totalExpenses,
    totalAnticipo,
    totalTarjetaEmpresa,
    totalPersonal,
    refundAmount,
    saldoAnticipoAntesReintegro,
    saldoPendienteDevolucion,
    saldoFavorColaborador,
    financialStatus,
    difference,
    balanceType,
    balanceAmount,
    importeDepositado: totalAmountPaid,
    gastosComprobados: totalExpenses,
    saldoNoUtilizado,
    importeADevolverDIMER,
    importeAdicionalReembolsar,
  };
}
