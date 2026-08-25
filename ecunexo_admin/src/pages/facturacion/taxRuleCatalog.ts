export const SRI_ONLINE_VOID_CODE = 'sri.void.online'

export type TaxRuleRow = {
  readonly code: string
  readonly description: string
  readonly payloadJson: string
  readonly validFrom: string
  readonly validTo: string | null
}

export type SriVoidPayload = {
  readonly deadlineDayOfFollowingMonth: number
  readonly extendToNextWeekday: boolean
  readonly consumerFinalCannotVoid: boolean
  readonly consumerFinalCannotCreditNote: boolean
}

export const DEFAULT_SRI_VOID_PAYLOAD: SriVoidPayload = {
  deadlineDayOfFollowingMonth: 7,
  extendToNextWeekday: true,
  consumerFinalCannotVoid: true,
  consumerFinalCannotCreditNote: true,
}

export type CreateTaxRuleBody = {
  readonly description: string
  readonly validFrom: string
  readonly deadlineDayOfFollowingMonth: number
  readonly extendToNextWeekday: boolean
  readonly consumerFinalCannotVoid: boolean
  readonly consumerFinalCannotCreditNote: boolean
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function parseSriVoidPayload(json: string): SriVoidPayload {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>
    const day = raw.deadlineDayOfFollowingMonth
    return {
      deadlineDayOfFollowingMonth:
        typeof day === 'number' && day >= 1 && day <= 31
          ? day
          : DEFAULT_SRI_VOID_PAYLOAD.deadlineDayOfFollowingMonth,
      extendToNextWeekday: asBoolean(
        raw.extendToNextWeekday,
        DEFAULT_SRI_VOID_PAYLOAD.extendToNextWeekday
      ),
      consumerFinalCannotVoid: asBoolean(
        raw.consumerFinalCannotVoid,
        DEFAULT_SRI_VOID_PAYLOAD.consumerFinalCannotVoid
      ),
      consumerFinalCannotCreditNote: asBoolean(
        raw.consumerFinalCannotCreditNote,
        DEFAULT_SRI_VOID_PAYLOAD.consumerFinalCannotCreditNote
      ),
    }
  } catch {
    return DEFAULT_SRI_VOID_PAYLOAD
  }
}

export function formatIsoDate(iso: string | null): string {
  if (!iso) return 'Vigente'
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

export function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function isRuleActiveOn(row: TaxRuleRow, isoDate: string): boolean {
  if (row.validFrom > isoDate) return false
  return row.validTo === null || row.validTo >= isoDate
}

export const RULE_KIND_TITLES: Readonly<Record<string, string>> = {
  [SRI_ONLINE_VOID_CODE]: 'Anulación en línea SRI',
}

export type TaxRuleKind = {
  readonly code: string
  readonly title: string
  readonly versions: readonly TaxRuleRow[]
  readonly current: TaxRuleRow | null
}

export function groupRulesByKind(rows: readonly TaxRuleRow[]): readonly TaxRuleKind[] {
  const today = todayIso()
  const byCode = new Map<string, TaxRuleRow[]>()
  for (const row of rows) {
    const list = byCode.get(row.code) ?? []
    list.push(row)
    byCode.set(row.code, list)
  }

  return [...byCode.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, versions]) => {
      const ordered = [...versions].sort((a, b) => b.validFrom.localeCompare(a.validFrom))
      return {
        code,
        title: RULE_KIND_TITLES[code] ?? code,
        versions: ordered,
        current: ordered.find((row) => isRuleActiveOn(row, today)) ?? null,
      }
    })
}

export function summarizeVersion(row: TaxRuleRow): string {
  if (row.code !== SRI_ONLINE_VOID_CODE) return row.description
  const payload = parseSriVoidPayload(row.payloadJson)
  const weekend = payload.extendToNextWeekday
    ? 'Si el plazo cae fin de semana, pasa al siguiente hábil.'
    : 'El plazo no se corre por fin de semana.'
  const consumer =
    payload.consumerFinalCannotVoid && payload.consumerFinalCannotCreditNote
      ? 'Consumidor final: sin anulación ni nota de crédito.'
      : payload.consumerFinalCannotVoid
        ? 'Consumidor final: sin anulación en línea.'
        : 'Consumidor final: permite anular.'
  return `Anulación en línea hasta el día ${payload.deadlineDayOfFollowingMonth} del mes siguiente. ${weekend} ${consumer}`
}
