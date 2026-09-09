export interface AppVersionInfo {
  version: string
  gitCommit: string
  gitBranch: string
  buildTime: string
  repositoryUrl: string
  commitUrl: string
  isProduction: boolean
}

export const APP_VERSION_INFO: AppVersionInfo = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0',
  gitCommit: typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'dev',
  gitBranch: typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'main',
  buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '',
  repositoryUrl: 'https://github.com/solivoo/Ecunexo_cliente',
  commitUrl: `https://github.com/solivoo/Ecunexo_cliente/commit/${typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : ''}`,
  isProduction: import.meta.env.PROD,
}

export function formatBuildDate(isoString: string): string {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat('es-EC', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return isoString
  }
}

export function buildSupportDiagnostics(context?: {
  tenantId?: string | null
  userId?: string | null
  userEmail?: string | null
}): string {
  const lines = [
    '=== DIAGNÓSTICO ECUNEXO ADMIN ===',
    `Versión: v${APP_VERSION_INFO.version}`,
    `Commit: ${APP_VERSION_INFO.gitCommit} (${APP_VERSION_INFO.gitBranch})`,
    `Compilación: ${APP_VERSION_INFO.buildTime ? formatBuildDate(APP_VERSION_INFO.buildTime) : 'Local dev'}`,
    `Modo: ${APP_VERSION_INFO.isProduction ? 'Producción' : 'Desarrollo'}`,
    `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconocido'}`,
    `Pantalla: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '—'}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : '—'}`,
  ]
  if (context?.tenantId) lines.push(`Empresa ID: ${context.tenantId}`)
  if (context?.userId) lines.push(`Usuario ID: ${context.userId}`)
  if (context?.userEmail) lines.push(`Usuario Email: ${context.userEmail}`)
  lines.push(`Fecha cliente: ${new Date().toISOString()}`)
  return lines.join('\n')
}
