import { Button, RangeDateBox, type DateRange } from 'glubox'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { rangeFromLookback, toIsoDate, type GridLookback, type IsoDateRange } from '@/lib/gridLookback'

type GridDateRangeBoxProps = {
  readonly from: string
  readonly to: string
  readonly lookback?: GridLookback
  readonly disabled?: boolean
  readonly showPresets?: boolean
  readonly onChange: (range: IsoDateRange) => void
}

function getPresetRange(preset: 'semanal' | 'mensual' | 'anual'): IsoDateRange {
  const now = new Date()
  const today = toIsoDate(now)
  if (preset === 'semanal') {
    const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    return { from: toIsoDate(fromDate), to: today }
  }
  if (preset === 'mensual') {
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    return { from: toIsoDate(fromDate), to: today }
  }
  const fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  return { from: toIsoDate(fromDate), to: today }
}

function getDaysDiff(fromIso: string, toIso: string): number {
  try {
    const d1 = new Date(fromIso).getTime()
    const d2 = new Date(toIso).getTime()
    return Math.round(Math.abs((d2 - d1) / (1000 * 3600 * 24)))
  } catch {
    return 0
  }
}

function computeActivePreset(from: string, to: string): 'semanal' | 'mensual' | 'anual' | 'custom' {
  const diff = getDaysDiff(from, to)
  if (diff >= 6 && diff <= 8) return 'semanal'
  if (diff >= 28 && diff <= 32) return 'mensual'
  if (diff >= 360 && diff <= 366) return 'anual'
  return 'custom'
}

export function GridDateRangeBox({
  from,
  to,
  lookback = '1m',
  disabled = false,
  showPresets = true,
  onChange,
}: GridDateRangeBoxProps) {
  const size = useGluComponentSize()
  const today = toIsoDate(new Date())
  const activePreset = computeActivePreset(from, to)

  return (
    <div
      className="ecu-grid-date-range"
      role="group"
      aria-label="Rango de fechas"
      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}
    >
      {showPresets && (
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <Button
            type="button"
            size="sm"
            variant={activePreset === 'semanal' ? 'primary' : 'outline'}
            onClick={() => onChange(getPresetRange('semanal'))}
            disabled={disabled}
            title="Filtrar por la última semana (7 días)"
          >
            Semanal
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activePreset === 'mensual' ? 'primary' : 'outline'}
            onClick={() => onChange(getPresetRange('mensual'))}
            disabled={disabled}
            title="Filtrar por el último mes (30 días)"
          >
            Mensual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activePreset === 'anual' ? 'primary' : 'outline'}
            onClick={() => onChange(getPresetRange('anual'))}
            disabled={disabled}
            title="Filtrar por el último año (365 días)"
          >
            Anual
          </Button>
        </div>
      )}

      <RangeDateBox
        variant="outline"
        size={size}
        startValue={from}
        endValue={to}
        max={today}
        width="21rem"
        separator="–"
        disabled={disabled}
        onChange={(next: DateRange) => {
          if (!next.start || !next.end) {
            onChange(rangeFromLookback(lookback))
            return
          }
          onChange({ from: next.start, to: next.end })
        }}
      />
    </div>
  )
}
