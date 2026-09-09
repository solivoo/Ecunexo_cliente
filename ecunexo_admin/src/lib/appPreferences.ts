import { applyEcuTheme, readStoredTheme } from '@/lib/ecuTheme'
import {
  DEFAULT_GRID_LOOKBACK,
  isGridLookback,
  type GridLookback,
} from '@/lib/gridLookback'

export const GLUBOX_THEME_IDS = ['default', 'modern', 'enterprise'] as const
export type GluboxThemeId = (typeof GLUBOX_THEME_IDS)[number]

export const UI_DENSITY_IDS = ['sm', 'md', 'lg'] as const
export type UiDensity = (typeof UI_DENSITY_IDS)[number]

export const TOAST_POSITION_IDS = [
  'bottom-right',
  'bottom-left',
  'bottom-center',
  'top-right',
  'top-left',
  'top-center',
] as const
export type ToastPositionId = (typeof TOAST_POSITION_IDS)[number]

export const TOAST_POSITION_OPTIONS: readonly { value: ToastPositionId; label: string }[] = [
  { value: 'bottom-right', label: 'Abajo a la derecha (Predeterminado)' },
  { value: 'bottom-left', label: 'Abajo a la izquierda' },
  { value: 'bottom-center', label: 'Abajo al centro' },
  { value: 'top-right', label: 'Arriba a la derecha' },
  { value: 'top-left', label: 'Arriba a la izquierda' },
  { value: 'top-center', label: 'Arriba al centro' },
] as const

export const MAX_RECORD_OPTIONS = [10, 20, 50, 100] as const
export type MaxRecords = (typeof MAX_RECORD_OPTIONS)[number]

export type AppPreferences = {
  readonly maxRecords: MaxRecords
  readonly defaultLookback: GridLookback
  readonly gluboxTheme: GluboxThemeId
  readonly density: UiDensity
  readonly startDarkMode: boolean
  readonly toastPosition: ToastPositionId
}

export const APP_PREFERENCES_EVENT = 'ecunexo:app-preferences'
const STORAGE_KEY = 'ecunexo.app.preferences'

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  maxRecords: 10,
  defaultLookback: DEFAULT_GRID_LOOKBACK,
  gluboxTheme: 'default',
  density: 'md',
  startDarkMode: true,
  toastPosition: 'bottom-right',
}

function isToastPosition(value: unknown): value is ToastPositionId {
  return typeof value === 'string' && (TOAST_POSITION_IDS as readonly string[]).includes(value)
}

function isGluboxTheme(value: unknown): value is GluboxThemeId {
  return typeof value === 'string' && (GLUBOX_THEME_IDS as readonly string[]).includes(value)
}

function isDensity(value: unknown): value is UiDensity {
  return typeof value === 'string' && (UI_DENSITY_IDS as readonly string[]).includes(value)
}

function isMaxRecords(value: unknown): value is MaxRecords {
  return typeof value === 'number' && (MAX_RECORD_OPTIONS as readonly number[]).includes(value)
}

export function pageSizeOptionsFor(maxRecords: MaxRecords): number[] {
  return MAX_RECORD_OPTIONS.filter((size) => size <= maxRecords)
}

export function readAppPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        ...DEFAULT_APP_PREFERENCES,
        startDarkMode: readStoredTheme() === 'dark',
      }
    }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_APP_PREFERENCES
    const row = parsed as Record<string, unknown>
    return {
      maxRecords: isMaxRecords(row.maxRecords) ? row.maxRecords : DEFAULT_APP_PREFERENCES.maxRecords,
      defaultLookback: isGridLookback(row.defaultLookback)
        ? row.defaultLookback
        : DEFAULT_APP_PREFERENCES.defaultLookback,
      gluboxTheme: isGluboxTheme(row.gluboxTheme) ? row.gluboxTheme : DEFAULT_APP_PREFERENCES.gluboxTheme,
      density: isDensity(row.density) ? row.density : DEFAULT_APP_PREFERENCES.density,
      startDarkMode: typeof row.startDarkMode === 'boolean'
        ? row.startDarkMode
        : DEFAULT_APP_PREFERENCES.startDarkMode,
      toastPosition: isToastPosition(row.toastPosition)
        ? row.toastPosition
        : DEFAULT_APP_PREFERENCES.toastPosition,
    }
  } catch {
    return DEFAULT_APP_PREFERENCES
  }
}

export function preferencesEqual(a: AppPreferences, b: AppPreferences): boolean {
  return (
    a.maxRecords === b.maxRecords
    && a.defaultLookback === b.defaultLookback
    && a.gluboxTheme === b.gluboxTheme
    && a.density === b.density
    && a.startDarkMode === b.startDarkMode
    && a.toastPosition === b.toastPosition
  )
}

export function preferencesFromResolvedSettings(
  settings: Record<string, unknown>,
  fallback: AppPreferences = DEFAULT_APP_PREFERENCES,
): AppPreferences {
  return {
    maxRecords: isMaxRecords(settings['ui.grid.max_records'])
      ? settings['ui.grid.max_records']
      : fallback.maxRecords,
    defaultLookback: isGridLookback(settings['ui.grid.default_lookback'])
      ? settings['ui.grid.default_lookback']
      : fallback.defaultLookback,
    gluboxTheme: isGluboxTheme(settings['ui.theme.palette'])
      ? settings['ui.theme.palette']
      : fallback.gluboxTheme,
    density: isDensity(settings['ui.density']) ? settings['ui.density'] : fallback.density,
    startDarkMode: typeof settings['ui.start_dark'] === 'boolean'
      ? settings['ui.start_dark']
      : fallback.startDarkMode,
    toastPosition: isToastPosition(settings['ui.toast.position'] ?? settings['ui.toast_position'])
      ? ((settings['ui.toast.position'] ?? settings['ui.toast_position']) as ToastPositionId)
      : fallback.toastPosition,
  }
}

export function applyDocumentPreferences(prefs: AppPreferences): void {
  const root = document.documentElement
  root.setAttribute('data-theme', prefs.gluboxTheme)
  root.setAttribute('data-density', prefs.density)
  applyEcuTheme(prefs.startDarkMode ? 'dark' : 'light')
}

export function writeAppPreferences(patch: Partial<AppPreferences>): AppPreferences {
  const next: AppPreferences = { ...readAppPreferences(), ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  applyDocumentPreferences(next)
  window.dispatchEvent(new Event(APP_PREFERENCES_EVENT))
  return next
}
