/**
 * Loma Soft / Independiente. Credenciales en .env.local.
 * Crea la empresa si el titular aún no tiene una. No toca el SRI.
 */
import { expect, test } from '@playwright/test'
import { ENSAYO_COMPANY_NAME } from '../../helpers/enterOperatingCompany'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { planByCode } from '../../helpers/planMatrix'
import {
  hasModule,
  hasRoute,
  readPersistedSession,
} from '../../helpers/readPersistedSession'
import { requirePlan } from '../../helpers/requirePlan'
import { walkAllowedRoutes } from '../../helpers/walkPlanRoutes'

const plan = planByCode('pro-independiente')

test.describe('Independiente — sesión y módulos', () => {
  test.beforeEach(() => {
    requirePlan('pro-independiente')
  })

  test('entra a Loma Soft con catálogo y facturación; sin bodegas ni inventario', async ({
    page,
  }) => {
    if (!plan) return
    await loginAsSeedUser(page, 'pro-independiente')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByText(/loma soft/i).first()).toBeVisible({ timeout: 15_000 })

    const session = await readPersistedSession(page)
    expect(session.modules.length, 'handshake con enabledModules').toBeGreaterThan(0)
    expect(hasModule(session.modules, 'catalog')).toBe(true)
    expect(hasModule(session.modules, 'invoicing')).toBe(true)
    expect(hasModule(session.modules, 'warehousing')).toBe(false)
    expect(hasModule(session.modules, 'inventory')).toBe(false)

    expect(hasRoute(session.routes, '/catalogo')).toBe(true)
    expect(hasRoute(session.routes, '/facturacion')).toBe(true)
    expect(hasRoute(session.routes, '/bodegas')).toBe(false)
    expect(hasRoute(session.routes, '/inventario')).toBe(false)
  })

  test('pantallas permitidas cargan', async ({ page }) => {
    if (!plan) return
    await loginAsSeedUser(page, 'pro-independiente')
    await walkAllowedRoutes(page, plan)
  })
})
