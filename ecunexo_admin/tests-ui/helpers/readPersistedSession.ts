import type { Page } from '@playwright/test'

export type PersistedSession = {
  readonly modules: string[]
  readonly routes: string[]
}

type NavNode = {
  route?: string | null
  disabled?: boolean
  placeholder?: boolean
  children?: NavNode[]
}

/** Sesión que el SPA guardó tras el handshake (módulos y menú ya filtrados). */
export async function readPersistedSession(page: Page): Promise<PersistedSession> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('persist:ecunexo-tenant-auth')
    if (!raw) return { modules: [], routes: [] }

    const bag = JSON.parse(raw) as Record<string, string>
    const parseKey = (key: string): unknown => {
      const value = bag[key]
      if (!value) return null
      return JSON.parse(value)
    }

    const modulesRaw = parseKey('enabledModules')
    const modules = Array.isArray(modulesRaw)
      ? modulesRaw.filter((m): m is string => typeof m === 'string')
      : []

    const nav = parseKey('navigation')
    const routes: string[] = []
    const walk = (nodes: unknown): void => {
      if (!Array.isArray(nodes)) return
      for (const node of nodes) {
        const item = node as NavNode
        const clickable =
          typeof item.route === 'string' &&
          item.route.length > 0 &&
          !item.disabled &&
          !item.placeholder
        if (clickable) {
          routes.push(item.route.startsWith('/') ? item.route : `/${item.route}`)
        }
        walk(item.children)
      }
    }
    walk(nav)
    return { modules, routes }
  })
}

export function hasRoute(routes: readonly string[], fragment: string): boolean {
  return routes.some((r) => r.includes(fragment))
}

export function hasModule(modules: readonly string[], code: string): boolean {
  const wanted = code.toLowerCase()
  const aliases = wanted === 'invoicing' || wanted === 'facturacion'
    ? ['invoicing', 'facturacion']
    : wanted === 'warehousing' || wanted === 'bodegas'
      ? ['warehousing']
      : [wanted]
  return modules.some((m) => aliases.includes(m.trim().toLowerCase()))
}
