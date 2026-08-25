import { expect, type Page } from '@playwright/test'
import type { PlanCode } from './planMatrix'
import { hasRoute, readPersistedSession } from './readPersistedSession'

export const ENSAYO_COMPANY_NAME = 'Loma Soft'
export const ENSAYO_LOCAL_COMPANY_NAME = 'Ferretería El Perno'
export const ENSAYO_TALLER_COMPANY_NAME = 'Taller El Eje'

const ENSAYO_COMPANY: Partial<Record<PlanCode, { name: string; ownerName: string }>> = {
  'pro-independiente': { name: 'Loma Soft', ownerName: 'Gabriela Loma' },
  'local-comercio': { name: 'Ferretería El Perno', ownerName: 'Marco Andrade' },
  'taller-mixto': { name: 'Taller El Eje', ownerName: 'Luis Paredes' },
}

async function isOperating(page: Page): Promise<boolean> {
  const session = await readPersistedSession(page)
  return hasRoute(session.routes, '/catalogo') || hasRoute(session.routes, '/facturacion')
}

async function waitUntilOperating(page: Page, timeoutMs: number): Promise<boolean> {
  try {
    await expect.poll(() => isOperating(page), { timeout: timeoutMs }).toBeTruthy()
    return true
  } catch {
    return false
  }
}

/** Titular sin empresa → crea la ficha del plan y pulsa Entrar. */
export async function enterOperatingCompany(
  page: Page,
  plan?: PlanCode,
  ownerPassword?: string
): Promise<void> {
  if (await waitUntilOperating(page, 3_000)) return

  const pickCompany = page.locator('#login-company')
  if (await pickCompany.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect.poll(() => isOperating(page), { timeout: 20_000 }).toBeTruthy()
    return
  }

  await page.goto('/organizacion/empresas')

  const quota = page.getByLabel('Cupo de licencia')
  const enter = page.getByRole('button', { name: 'Entrar' })
  const empty = page.getByRole('heading', { name: 'Aún no hay empresas' })
  await expect(quota).toBeVisible({ timeout: 20_000 })

  if (await isOperating(page)) return

  if (await empty.isVisible()) {
    const ficha = (plan && ENSAYO_COMPANY[plan]) || ENSAYO_COMPANY['pro-independiente']!
    await page.getByRole('button', { name: 'Crear primera empresa' }).click()
    await expect(page.locator('#cc-name')).toBeVisible({ timeout: 20_000 })
    await page.locator('#cc-name').fill(ficha.name)

    const owner = page.locator('#cc-owner')
    if (!(await owner.inputValue()).trim()) {
      await owner.fill(ficha.ownerName)
    }

    const password = ownerPassword || process.env.E2E_INDEPENDIENTE_PASSWORD || process.env.E2E_PASSWORD || ''
    if (password.length < 8) {
      throw new Error(
        'La contraseña del titular (E2E_*_PASSWORD) debe tener al menos 8 caracteres para crear la empresa.'
      )
    }
    await page.locator('#cc-password').fill(password)
    await page.locator('#cc-password-confirm').fill(password)
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText(new RegExp(ficha.name, 'i')).first()).toBeVisible({ timeout: 20_000 })
  }

  if (await enter.first().isVisible()) {
    await enter.first().click()
  }

  await expect.poll(() => isOperating(page), { timeout: 20_000 }).toBeTruthy()
}
