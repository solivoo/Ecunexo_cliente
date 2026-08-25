import type { PlanCapability } from './planMatrix'

export type ProvisionedOrg = {
  readonly plan: PlanCapability
  readonly customerId: string
  readonly licenseId: string
  readonly tenantId: string
  readonly ownerEmail: string
  readonly ownerPassword: string
  readonly companyName: string
  readonly holderToken: string
  readonly operatorToken: string
}

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : fallback
}

export function licenseMatrixEnabled(): boolean {
  return process.env.E2E_LICENSE_MATRIX === '1'
}

export function platformBaseUrl(): string {
  return env('E2E_PLATFORM_URL', 'http://localhost:5090').replace(/\/$/, '')
}

export function tenantApiBaseUrl(): string {
  return env('E2E_TENANT_API', 'http://localhost:5088').replace(/\/$/, '')
}

async function readJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${label} HTTP ${response.status}: ${text.slice(0, 500)}`)
  }
  if (!text) {
    throw new Error(`${label}: respuesta vacía`)
  }
  return JSON.parse(text) as T
}

async function sendJson<T>(
  url: string,
  init: RequestInit,
  label: string
): Promise<T> {
  const response = await fetch(url, init)
  return readJson<T>(response, label)
}

async function pingOrThrow(url: string, label: string, acceptStatuses: number[] = []): Promise<void> {
  try {
    const response = await fetch(url)
    if (response.ok || acceptStatuses.includes(response.status)) return
    throw new Error(`${label} respondió HTTP ${response.status}.`)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    if (detail.includes('ECONNREFUSED') || detail.includes('fetch failed')) {
      throw new Error(`${label} no está en marcha (${url}).`)
    }
    throw err instanceof Error ? err : new Error(detail)
  }
}

export async function assertApisUp(): Promise<void> {
  await pingOrThrow(
    `${platformBaseUrl()}/api/v1/platform/health`,
    'Platform (ecunexo_license_api :5090)'
  )
  await pingOrThrow(
    `${tenantApiBaseUrl()}/api/v1/onboarding/status`,
    'Tenant API (ecunexo_api :5088)',
    [401]
  )
}

export async function listActivePlanCodes(): Promise<Set<string>> {
  const login = await operatorLogin()
  const payload = await sendJson<
    Array<{ code: string; isActive: boolean }> | { items?: Array<{ code: string; isActive: boolean }> }
  >(
    `${platformBaseUrl()}/api/v1/platform/plans`,
    { headers: { Authorization: `Bearer ${login.accessToken}` } },
    'GET plans'
  )
  const rows = Array.isArray(payload) ? payload : (payload.items ?? [])
  return new Set(rows.filter((p) => p.isActive).map((p) => p.code))
}

async function operatorLogin(): Promise<{ accessToken: string }> {
  return sendJson<{ accessToken: string }>(
    `${platformBaseUrl()}/api/v1/platform/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: env('E2E_PLATFORM_EMAIL', 'admin.licencias@ecunexo.local'),
        password: env('E2E_PLATFORM_PASSWORD', 'Licencias123!'),
      }),
    },
    'Operator login'
  )
}

function fakeRuc(stamp: string): string {
  const digits = stamp.replace(/\D/g, '').padStart(8, '0').slice(-8)
  return `17${digits}001`
}

export async function provisionPlanOrg(plan: PlanCapability): Promise<ProvisionedOrg> {
  const stamp = `${Date.now().toString().slice(-8)}`
  const ownerEmail = `pw.${plan.code}.${stamp}@ecunexo.test`
  const ownerPassword = 'PwPlan2026!'
  const ownerName = `PW ${plan.label}`
  const companyName = `PW ${plan.label} ${stamp}`
  const operator = await operatorLogin()

  let customerId = ''
  try {
  const customer = await sendJson<{ id: string }>(
    `${platformBaseUrl()}/api/v1/platform/customers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operator.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        legalName: companyName,
        deploymentMode: 0,
        countryCode: 'EC',
        tradeName: companyName,
        taxId: fakeRuc(stamp),
        contactName: ownerName,
        contactEmail: ownerEmail,
        notes: 'Playwright plan-lifecycle — borrar al terminar',
      }),
    },
    'Create customer'
  )
  customerId = customer.id

  const issued = await sendJson<{
    licenseId: string
    activationCodePlaintext: string
    licenseArtifact: string
  }>(
    `${platformBaseUrl()}/api/v1/platform/licenses`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operator.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: customer.id,
        planCode: plan.code,
        deploymentMode: 0,
        validityDays: 30,
        onlineValidationIntervalDays: 30,
        notes: `e2e ${plan.code}`,
        provisioning: {
          ownerEmail,
          ownerName,
          ownerPassword,
        },
      }),
    },
    'Issue license'
  )

  const activated = await sendJson<{
    accessToken: string
    isSubscriptionHolder: boolean
  }>(
    `${tenantApiBaseUrl()}/api/v1/onboarding/activate-license`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activationCode: issued.activationCodePlaintext,
        licenseArtifact: issued.licenseArtifact,
      }),
    },
    'Activate license'
  )

  const company = await sendJson<{ tenantId: string }>(
    `${tenantApiBaseUrl()}/api/v1/subscription/companies`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activated.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantName: companyName,
        ownerEmail,
        ownerName,
        ownerPassword,
        timeZoneId: 'America/Guayaquil',
        locale: 'es-EC',
        primaryColorHex: '#1D4ED8',
      }),
    },
    'Provision company'
  )

  return {
    plan,
    customerId: customer.id,
    licenseId: issued.licenseId,
    tenantId: company.tenantId,
    ownerEmail,
    ownerPassword,
    companyName,
    holderToken: activated.accessToken,
    operatorToken: operator.accessToken,
  }
  } catch (err) {
    if (customerId) {
      await fetch(`${platformBaseUrl()}/api/v1/platform/customers/${customerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${operator.accessToken}` },
      }).catch(() => undefined)
    }
    throw err
  }
}

export async function disposePlanOrg(org: ProvisionedOrg | null): Promise<void> {
  if (!org) return

  const errors: string[] = []
  try {
    const cancel = await fetch(
      `${tenantApiBaseUrl()}/api/v1/subscription/companies/${org.tenantId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${org.holderToken}` },
      }
    )
    if (!cancel.ok && cancel.status !== 404) {
      errors.push(`cancel company HTTP ${cancel.status}`)
    }
  } catch (err) {
    errors.push(`cancel company: ${String(err)}`)
  }

  try {
    const deactivate = await fetch(
      `${platformBaseUrl()}/api/v1/platform/customers/${org.customerId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${org.operatorToken}` },
      }
    )
    if (!deactivate.ok && deactivate.status !== 404) {
      errors.push(`deactivate customer HTTP ${deactivate.status}`)
    }
  } catch (err) {
    errors.push(`deactivate customer: ${String(err)}`)
  }

  if (errors.length > 0) {
    console.warn(`Limpieza incompleta ${org.plan.code}: ${errors.join('; ')}`)
  }
}
