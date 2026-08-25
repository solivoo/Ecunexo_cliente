import { expect, type Page } from '@playwright/test'
import { routesForPlan, type PlanCapability } from './planMatrix'

export async function walkAllowedRoutes(page: Page, plan: PlanCapability): Promise<void> {
  for (const route of routesForPlan(plan)) {
    if (!route.allowed) continue
    await page.goto(route.path)
    const marker =
      route.ready.kind === 'label'
        ? page.getByLabel(route.ready.name)
        : page.getByRole('heading', { name: route.ready.name }).first()
    await expect(marker).toBeVisible({ timeout: 20_000 })
  }
}
