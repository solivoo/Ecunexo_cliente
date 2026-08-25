/**
 * Ciclo por plan: emitir licencia → activar → empresa → pantallas del plan → borrar.
 *
 * No corre en `pnpm test:ui` salvo con:
 *   pnpm test:ui:ciclo
 *
 * Requiere: ecunexo_license_api :5090, ecunexo_api :5088, Vite admin.
 * No usa Andes ni el RUC de EcuNexo: cada corrida crea y apaga su propio cliente.
 */
import { expect, test } from '@playwright/test'
import {
  assertApisUp,
  disposePlanOrg,
  licenseMatrixEnabled,
  listActivePlanCodes,
  provisionPlanOrg,
  type ProvisionedOrg,
} from '../helpers/licenseLifecycle'
import { loginAs, credentialsForPlan } from '../helpers/loginAsSeedUser'
import { PLAN_MATRIX } from '../helpers/planMatrix'
import {
  hasModule,
  hasRoute,
  readPersistedSession,
} from '../helpers/readPersistedSession'
import { walkAllowedRoutes } from '../helpers/walkPlanRoutes'

test.describe('Ciclo de licencia por plan', () => {
  test.skip(!licenseMatrixEnabled(), 'Define E2E_LICENSE_MATRIX=1 (APIs platform + tenant).')

  test.beforeAll(async () => {
    if (!licenseMatrixEnabled()) return
    try {
      await assertApisUp()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      test.skip(true, message)
    }
  })

  for (const plan of PLAN_MATRIX) {
    test.describe(plan.label, () => {
      let org: ProvisionedOrg | null = null

      test.afterEach(async () => {
        await disposePlanOrg(org)
        org = null
      })

      test(`emitir, activar y recorrer ${plan.code}`, async ({ page }) => {
        await assertApisUp()
        const active = await listActivePlanCodes()
        test.skip(!active.has(plan.code), `El plan ${plan.code} no está activo en Platform.`)

        const creds = credentialsForPlan(plan.code)
        const useFixed = Boolean(creds)

        if (useFixed && creds) {
          await loginAs(page, creds.email, creds.password, plan.code)
        } else {
          org = await provisionPlanOrg(plan)
          await loginAs(page, org.ownerEmail, org.ownerPassword)
        }
        await expect(page.locator('.app-shell')).toBeVisible()

        const session = await readPersistedSession(page)
        expect(session.modules.length, 'handshake debe traer enabledModules del plan').toBeGreaterThan(0)
        expect(hasModule(session.modules, 'catalog'), 'catálogo').toBe(plan.catalog)
        expect(hasModule(session.modules, 'warehousing'), 'bodegas').toBe(plan.warehouses)
        expect(hasModule(session.modules, 'inventory'), 'inventario').toBe(plan.inventory)
        expect(hasModule(session.modules, 'invoicing'), 'facturación').toBe(plan.invoicing)

        expect(hasRoute(session.routes, '/catalogo')).toBe(plan.catalog)
        expect(hasRoute(session.routes, '/bodegas')).toBe(plan.warehouses)
        expect(hasRoute(session.routes, '/inventario')).toBe(plan.inventory)
        expect(hasRoute(session.routes, '/facturacion')).toBe(plan.invoicing)

        await walkAllowedRoutes(page, plan)
      })
    })
  }
})
