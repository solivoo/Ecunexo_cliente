/** Extrae el claim `sub` de un JWT (HMAC) sin validar firma; solo para UX / cabeceras opcionales. */
export function readJwtSub(accessToken: string | null): string | null {
  if (!accessToken) return null
  const parts = accessToken.split('.')
  if (parts.length < 2) return null
  try {
    let segment = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (segment.length % 4) segment += '='
    const json = JSON.parse(atob(segment)) as { sub?: string }
    return typeof json.sub === 'string' ? json.sub : null
  } catch {
    return null
  }
}
