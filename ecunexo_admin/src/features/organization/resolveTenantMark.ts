export function resolveAssetUrl(path: string | null | undefined): string | null {
  const raw = path?.trim() ?? ''
  if (!raw) return null
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw
  const base = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:5088'
  return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`
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
  const wordmark = input.name.trim().toUpperCase() || 'EMPRESA'
  if (input.preferWordmark) return { kind: 'wordmark', text: wordmark }

  const light = resolveAssetUrl(input.logoLightUrl)
  const dark = resolveAssetUrl(input.logoDarkUrl)
  const legacy = resolveAssetUrl(input.logoUrl)
  const preferred = input.theme === 'dark' ? dark ?? light : light ?? dark
  const src = preferred ?? legacy
  if (src) return { kind: 'image', src }
  return { kind: 'wordmark', text: wordmark }
}
