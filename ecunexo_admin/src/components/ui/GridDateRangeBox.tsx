import { RangeDateBox, type DateRange } from 'glubox'
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

export function GridDateRangeBox({
  from,
  to,
  lookback = '1m',
  disabled = false,
  onChange,
}: GridDateRangeBoxProps) {
  const size = useGluComponentSize()
  const today = toIsoDate(new Date())

  return (
    <div
      className="ecu-grid-date-range"
      role="group"
      aria-label="Rango de fechas"
      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}
    >
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
