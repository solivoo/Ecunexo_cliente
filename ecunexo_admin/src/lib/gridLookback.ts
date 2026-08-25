export const GRID_LOOKBACK_IDS = ['1m', '3m', '6m', '1y'] as const
export type GridLookback = (typeof GRID_LOOKBACK_IDS)[number]

export const GRID_LOOKBACK_OPTIONS: readonly { value: GridLookback; label: string }[] = [
  { value: '1m', label: '1 mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '1y', label: '1 año' },
]

export const DEFAULT_GRID_LOOKBACK: GridLookback = '1m'

const LOOKBACK_MONTHS: Record<GridLookback, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
}

export type IsoDateRange = {
  readonly from: string
  readonly to: string
}

export function isGridLookback(value: unknown): value is GridLookback {
  return typeof value === 'string' && (GRID_LOOKBACK_IDS as readonly string[]).includes(value)
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addCalendarMonths(date: Date, months: number): Date {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + months + 1, 0).getDate()
  const day = Math.min(date.getDate(), lastDay)
  return new Date(date.getFullYear(), date.getMonth() + months, day)
}

export function rangeFromLookback(
  lookback: GridLookback,
  now: Date = new Date(),
): IsoDateRange {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const from = addCalendarMonths(to, -LOOKBACK_MONTHS[lookback])
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

/** Fecha civil del instante, zona Ecuador, para filtrar grillas. */
export function isoDayInEcuador(iso: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return null
  }
}

export function isoInstantInRange(iso: string, range: IsoDateRange): boolean {
  const day = isoDayInEcuador(iso)
  return day !== null && day >= range.from && day <= range.to
}
