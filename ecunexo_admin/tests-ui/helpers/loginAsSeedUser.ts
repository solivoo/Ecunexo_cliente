import { expect, type Page } from '@playwright/test'
import { enterOperatingCompany } from './enterOperatingCompany'
import { planByCode, type PlanCode } from './planMatrix'

const PLAN_ENV_PREFIX: Record<PlanCode, string> = {
  'pro-independiente': 'INDEPENDIENTE',
  'local-comercio': 'LOCAL',
  'taller-mixto': 'TALLER',
  'empresa-pyme': 'EMPRESA',
  'cadena-retail': 'CADENA',
  'grupo-multi-ruc': 'GRUPO',
}

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? ''
}

function envRaw(name: string): string {
  return process.env[name] ?? ''
}

export function planEnvPrefix(code: PlanCode): string {
  return PLAN_ENV_PREFIX[code]
}

/** Credenciales del bloque `E2E_<PLAN>_*`. El genérico `E2E_EMAIL` solo aplica al plan de `E2E_PLAN` (o Independiente). */
export function credentialsForPlan(code: PlanCode): { email: string; password: string } | null {
  const prefix = PLAN_ENV_PREFIX[code]
  const email = envTrim(`E2E_${prefix}_EMAIL`)
  const password = envRaw(`E2E_${prefix}_PASSWORD`)
  if (email && password) return { email, password }

  const genericEmail = envTrim('E2E_EMAIL')
  const genericPassword = envRaw('E2E_PASSWORD')
  const genericPlan = envTrim('E2E_PLAN')
  if (!genericEmail || !genericPassword) return null
  if (genericPlan && genericPlan !== code) return null
  if (!genericPlan && code !== 'pro-independiente') return null
  return { email: genericEmail, password: genericPassword }
}

export function e2ePlanCode(): PlanCode {
  const named = envTrim('E2E_PLAN')
  if (named && planByCode(named)) return named as PlanCode
  if (credentialsForPlan('pro-independiente')) return 'pro-independiente'
  if (credentialsForPlan('local-comercio')) return 'local-comercio'
  return 'pro-independiente'
}

export function e2eCredentials(plan?: PlanCode): { email: string; password: string } {
  const code = plan ?? e2ePlanCode()
  const creds = credentialsForPlan(code)
  if (!creds) {
    const prefix = PLAN_ENV_PREFIX[code]
    throw new Error(
      `Define E2E_${prefix}_EMAIL y E2E_${prefix}_PASSWORD (o E2E_EMAIL / E2E_PASSWORD) en .env.local`
    )
  }
  return creds
}

export async function loginAs(
  page: Page,
  email: string,
  password: string,
  plan?: PlanCode
): Promise<void> {
  await page.goto('/')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  const enterCompany = page.getByRole('button', { name: 'Entrar' })
  const shell = page.locator('.app-shell')
  const alert = page.getByRole('alert')
  await expect(enterCompany.or(shell).or(alert)).toBeVisible({ timeout: 20_000 })

  if (await alert.isVisible()) {
    throw new Error(`Login falló: ${await alert.innerText()}`)
  }

  if (await enterCompany.isVisible()) {
    await enterCompany.click()
  }

  await expect(shell).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('persist:ecunexo-tenant-auth'))))
    .toBeTruthy()

  await enterOperatingCompany(page, plan, password)
}

export async function loginAsSeedUser(page: Page, plan?: PlanCode): Promise<void> {
  const code = plan ?? e2ePlanCode()
  const { email, password } = e2eCredentials(code)
  await loginAs(page, email, password, code)
}
