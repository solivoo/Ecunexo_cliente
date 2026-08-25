import { useAppPreferences } from '@/features/settings/AppPreferencesProvider'
import type { UiDensity } from '@/lib/appPreferences'

/** Tamaño sm | md | lg de controles gluBox, alineado a Preferencias. */
export function useGluComponentSize(): UiDensity {
  return useAppPreferences().prefs.density
}
