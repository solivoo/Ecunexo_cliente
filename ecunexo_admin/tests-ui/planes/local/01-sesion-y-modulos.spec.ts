/**
 * Ferretería El Perno / Local. Credenciales E2E_LOCAL_* en .env.local.
 * Crea la empresa si el titular aún no tiene una. No toca el SRI.
 */
import { expect, test } from '@playwright/test'
import { ENSAYO_LOCAL_COMPANY_NAME } from '../../helpers/enterOperatingCompany'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { planByCode } from '../../helpers/planMatrix'
import {
  hasModule,
  hasRoute,
  readPersistedSession,
} from '../../helpers/readPersistedSession'
import { requirePlan } from '../../helpers/requirePlan'
import { walkAllowedRoutes } from '../../helpers/walkPlanRoutes'

const plan = planByCode('local-comercio')

test.describe('Local — sesión y módulos', () => {
  test.beforeEach(() => {
    requirePlan('local-comercio')
  })

  test('entra a El Perno con catálogo, bodegas, inventario y facturación', async ({ page }) => {
    if (!plan) return
    await loginAsSeedUser(page, 'local-comercio')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByText(new RegExp(ENSAYO_LOCAL_COMPANY_NAME, 'i')).first()).toBeVisible({
      timeout: 15_000,
    })

    const session = await readPersistedSession(page)
    expect(session.modules.length, 'handshake con enabledModules').toBeGreaterThan(0)
    expect(hasModule(session.modules, 'catalog')).toBe(true)
    expect(hasModule(session.modules, 'invoicing')).toBe(true)
    expect(hasModule(session.modules, 'warehousing')).toBe(true)
    expect(hasModule(session.modules, 'inventory')).toBe(true)

    expect(hasRoute(session.routes, '/catalogo')).toBe(true)
    expect(hasRoute(session.routes, '/facturacion')).toBe(true)
    expect(hasRoute(session.routes, '/bodegas')).toBe(true)
    expect(hasRoute(session.routes, '/inventario')).toBe(true)
  })

  test('pantallas permitidas cargan', async ({ page }) => {
    if (!plan) return
    await loginAsSeedUser(page, 'local-comercio')
    await walkAllowedRoutes(page, plan)
  })
})
