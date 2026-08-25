import { test } from '@playwright/test'
import { credentialsForPlan, planEnvPrefix } from './loginAsSeedUser'
import { planByCode, type PlanCode } from './planMatrix'

/** Titular fijo: Independiente o `E2E_EMAIL`. No emite licencia. */
export function requireFixedCredentials(): void {
  const ok =
    credentialsForPlan('pro-independiente') ||
    Boolean(process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD)
  test.skip(!ok, 'Define E2E_INDEPENDIENTE_EMAIL/PASSWORD o E2E_EMAIL/PASSWORD en .env.local')
}

/** Corre si hay bloque `E2E_<PLAN>_*` (o genérico) para este código. No exige un único `E2E_PLAN`. */
export function requirePlan(code: PlanCode): void {
  test.skip(!planByCode(code), `El plan ${code} no está en la matriz.`)
  const creds = credentialsForPlan(code)
  const prefix = planEnvPrefix(code)
  test.skip(
    !creds,
    `Define E2E_${prefix}_EMAIL y E2E_${prefix}_PASSWORD en .env.local para ${code}`
  )
}
