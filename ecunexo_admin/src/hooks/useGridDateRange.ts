import { useEffect, useState } from 'react'
import { useAppPreferences } from '@/features/settings/AppPreferencesProvider'
import {
  rangeFromLookback,
  type IsoDateRange,
} from '@/lib/gridLookback'

export function useGridDateRange() {
  const { prefs } = useAppPreferences()
  const lookback = prefs.defaultLookback
  const [range, setRange] = useState<IsoDateRange>(() => rangeFromLookback(lookback))

  useEffect(() => {
    setRange(rangeFromLookback(lookback))
  }, [lookback])

  return { from: range.from, to: range.to, range, setRange, lookback }
}
