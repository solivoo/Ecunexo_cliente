import { GRID_LOOKBACK_OPTIONS } from '@/lib/gridLookback'

const SETTING_LABELS: Record<string, string> = {
  'ui.theme.default': 'Tema de interfaz',
  'ui.realtime.enabled': 'Notificaciones en tiempo real',
  'ui.grid.max_records': 'Registros por página',
  'ui.grid.default_lookback': 'Ventana de fechas de listados',
}

export function settingLabel(code: string): string {
  return SETTING_LABELS[code] ?? code
}

export function formatSettingValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'string') {
    let trimmed = value.trim()
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      trimmed = trimmed.slice(1, -1)
    }
    const lookback = GRID_LOOKBACK_OPTIONS.find((option) => option.value === trimmed)
    if (lookback) return lookback.label
    return trimmed
  }
  return JSON.stringify(value)
}

export function themeSettingLabel(value: unknown): string {
  const raw = formatSettingValue(value).toLowerCase()
  if (raw === 'light') return 'Claro'
  if (raw === 'dark') return 'Oscuro'
  if (raw === 'system') return 'Según el sistema'
  return raw
}
