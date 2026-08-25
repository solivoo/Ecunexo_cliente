export const RIDE_DEFAULT_ACCENT = '#1e3a4c'

export type RidePalette = {
  readonly accent: string
  readonly accentDeep: string
  readonly accentSoft: string
  readonly onAccent: string
  readonly ink: string
  readonly muted: string
  readonly hairline: string
  readonly headerFill: string
  readonly surface: string
  readonly zebra: string
  readonly paper: string
}

function expandHex(hex: string): string | null {
  const raw = hex.trim()
  if (/^#([0-9A-Fa-f]{6})$/.test(raw)) return raw.toUpperCase()
  if (/^#([0-9A-Fa-f]{3})$/.test(raw)) {
    const r = raw[1]
    const g = raw[2]
    const b = raw[3]
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return null
}

function channel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16)
}

function luminance(hex: string): number {
  const n = hex.slice(1)
  const r = channel(n, 0) / 255
  const g = channel(n, 2) / 255
  const b = channel(n, 4) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function darken(hex: string, factor: number): string {
  const n = hex.slice(1)
  const ch = (start: number): string => {
    const value = Math.round(channel(n, start) * factor)
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
  }
  return `#${ch(0)}${ch(2)}${ch(4)}`.toUpperCase()
}

function mix(hex: string, onto: string, amount: number): string {
  const a = hex.slice(1)
  const b = onto.slice(1)
  const ch = (start: number): string => {
    const value = Math.round(channel(b, start) * (1 - amount) + channel(a, start) * amount)
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
  }
  return `#${ch(0)}${ch(2)}${ch(4)}`.toUpperCase()
}

export function buildRidePalette(accentHex: string | null | undefined): RidePalette {
  const accent = expandHex(accentHex ?? '') ?? RIDE_DEFAULT_ACCENT
  const accentDeep = darken(accent, 0.78)
  return {
    accent,
    accentDeep,
    accentSoft: mix(accent, '#FFFFFF', 0.12),
    onAccent: luminance(accentDeep) > 0.55 ? '#1C1F24' : '#F8FAFC',
    ink: '#1C1F24',
    muted: '#6B7280',
    hairline: '#D5DAE1',
    headerFill: '#F3F4F6',
    surface: '#FFFFFF',
    zebra: '#FAFBFC',
    paper: '#FFFFFF',
  }
}
