import defaultLogoDark from '@/assets/solo_logo_ecunexo_dark.svg'
import defaultLogoLight from '@/assets/solo_logo_ecunexo_light.svg'

export function isEcuNexoBrand(name: string | null | undefined): boolean {
  const normalized = (name ?? '').trim().toLowerCase()
  return !normalized || normalized === 'ecunexo' || normalized === 'ecu nexo'
}

export function resolveAssetUrl(path: string | null | undefined): string | null {
  const raw = path?.trim() ?? ''
  if (!raw) return null
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw
  const relative = raw.startsWith('/') ? raw : `/${raw}`
  // Vacío = mismo origen (Nginx proxy /api). Dev local sin .env → :5088.
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  const base =
    configured !== undefined && configured !== ''
      ? configured
      : import.meta.env.DEV
        ? 'http://localhost:5088'
        : ''
  return base ? `${base}${relative}` : relative
}

export type TenantMark =
  | { readonly kind: 'image'; readonly src: string }
  | { readonly kind: 'wordmark'; readonly text: string }

export function resolveTenantMark(input: {
  readonly name: string
  readonly preferWordmark?: boolean | null
  readonly logoLightUrl?: string | null
  readonly logoDarkUrl?: string | null
  readonly logoUrl?: string | null
  readonly theme: 'light' | 'dark'
}): TenantMark {
  const isEcuNexo = isEcuNexoBrand(input.name)

  if (input.preferWordmark && !isEcuNexo) {
    const wordmark = input.name.trim().toUpperCase() || 'EMPRESA'
    return { kind: 'wordmark', text: wordmark }
  }

  const light = resolveAssetUrl(input.logoLightUrl)
  const dark = resolveAssetUrl(input.logoDarkUrl)
  const legacy = resolveAssetUrl(input.logoUrl)
  const preferred = input.theme === 'dark' ? dark ?? light : light ?? dark
  const src = preferred ?? legacy
  if (src) return { kind: 'image', src }

  if (isEcuNexo) {
    const defaultLogo = input.theme === 'dark' ? defaultLogoDark : defaultLogoLight
    return { kind: 'image', src: defaultLogo }
  }

  const wordmark = input.name.trim().toUpperCase() || 'EMPRESA'
  return { kind: 'wordmark', text: wordmark }
}
