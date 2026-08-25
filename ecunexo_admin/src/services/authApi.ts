import { api } from '@/lib/apiClient'
import type { NavigationNode } from '@/types/navigation'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResult {
  accessToken: string
  expiresAt: string
  userId: string
  tenantId: string | null
  isSubscriptionHolder: boolean
}

/** Credenciales para una petición autenticada antes de persistir en Redux. */
export type SessionAuth = {
  accessToken: string
  tenantId: string | null
  userId: string
  isSubscriptionHolder?: boolean
}

export interface SubscriptionSessionDto {
  id: string
  servicePlanName: string
  maxUsers: number
  maxWarehouses: number
  subscriptionMaxTenants: number
  enabledModules: string[] | null
  moduleEntitlements?: ModuleEntitlementDto[] | null
  resolvedLimits?: Record<string, number> | null
}

export interface ModuleEntitlementDto {
  moduleCode: string
  tier: number
  limits?: Record<string, number>
}

export interface SessionPayload {
  user: {
    id: string
    email: string
    name: string
    department: string | null
    phone: string | null
    jobTitle: string | null
    roleIds: string[]
  }
  tenant: {
    id: string
    name: string
    timeZoneId: string | null
    locale: string | null
    logoUrl: string | null
    logoLightUrl?: string | null
    logoDarkUrl?: string | null
    preferWordmark?: boolean
    primaryColorHex: string | null
    status: number
    servicePlanName: string
    maxUsers: number
    maxWarehouses: number
    subscriptionMaxTenants: number
    enabledModules: string[] | null
    moduleEntitlements?: ModuleEntitlementDto[] | null
    resolvedLimits?: Record<string, number> | null
  } | null
  subscription?: SubscriptionSessionDto
  isSubscriptionHolder?: boolean
  permissions: string[]
  settings: Record<string, unknown>
  navigation: NavigationNode[]
  menuContexts?: string[]
  permVersion: string
}

export async function loginWithPassword(body: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>('/api/v1/auth/login', body)
  return data
}

/**
 * Carga permisos, navegación y datos del tenant para el SPA.
 * El tenantId en la ruta viene del JWT (login/activación), no lo escribe el usuario.
 */
export async function fetchSession(
  tenantId: string,
  auth?: SessionAuth
): Promise<SessionPayload> {
  const { data } = await api.get<SessionPayload>(`/api/v1/tenants/${tenantId}/session`, {
    ecuAuth: auth,
  })
  return data
}

/** Sesión del titular de licencia (sin tenant). */
export async function fetchSubscriptionSession(auth?: SessionAuth): Promise<SessionPayload> {
  const { data } = await api.get<SessionPayload>('/api/v1/subscription/session', {
    ecuAuth: auth,
  })
  return {
    ...data,
    tenant: null,
    isSubscriptionHolder: true,
  }
}

export function subscriptionSessionToPayload(raw: SessionPayload): SessionPayload {
  return {
    ...raw,
    tenant: null,
    isSubscriptionHolder: true,
  }
}
