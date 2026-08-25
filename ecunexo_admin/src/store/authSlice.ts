import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { readJwtSub } from '@/lib/jwtSub'
import type { ModuleEntitlementDto, SessionPayload, SubscriptionSessionDto } from '@/services/authApi'
import type { TenantBranding } from '@/types/tenantBranding'
import { defaultTenantBranding } from '@/types/tenantBranding'
import { filterNavigationTree } from '@/features/navigation/filterNavigation'
import type { NavigationNode } from '@/types/navigation'
import { clearSession, getAccessToken, getTenantId, getUserId } from '@/services/authStorage'
import { loginThunk } from '@/store/thunks/authThunks'

/** Token del titular guardado al entrar a una empresa (para volver sin re-login). */
export type HolderResume = {
  accessToken: string
  userId: string
}

export type AuthState = {
  accessToken: string | null
  tenantId: string | null
  userId: string | null
  userEmail: string | null
  userName: string | null
  isSubscriptionHolder: boolean
  subscription: SubscriptionSessionDto | null
  tenant: TenantBranding
  enabledModules: string[] | null
  moduleEntitlements: ModuleEntitlementDto[] | null
  permissions: string[]
  navigation: NavigationNode[]
  settings: Record<string, unknown>
  holderResume: HolderResume | null
  loginStatus: 'idle' | 'loading' | 'succeeded' | 'failed'
  loginError: string | null
}

const initialState: AuthState = {
  accessToken: null,
  tenantId: null,
  userId: null,
  userEmail: null,
  userName: null,
  isSubscriptionHolder: false,
  subscription: null,
  tenant: defaultTenantBranding,
  enabledModules: null,
  moduleEntitlements: null,
  permissions: [],
  navigation: [],
  settings: {},
  holderResume: null,
  loginStatus: 'idle',
  loginError: null,
}

function tenantFromSession(tenant: NonNullable<SessionPayload['tenant']>): TenantBranding {
  return {
    name: tenant.name,
    logoUrl: tenant.logoUrl,
    logoLightUrl: tenant.logoLightUrl ?? null,
    logoDarkUrl: tenant.logoDarkUrl ?? null,
    preferWordmark: tenant.preferWordmark ?? false,
    primaryColorHex: tenant.primaryColorHex,
  }
}

function applySession(state: AuthState, session: SessionPayload): void {
  state.permissions = session.permissions
  state.navigation = session.navigation
  state.settings = session.settings
  state.userId = session.user.id
  state.userEmail = session.user.email
  state.userName = session.user.name
  state.isSubscriptionHolder = session.isSubscriptionHolder ?? Boolean(session.subscription)
  state.subscription = session.subscription ?? null

  if (session.tenant) {
    state.tenantId = session.tenant.id
    state.tenant = tenantFromSession(session.tenant)
    state.enabledModules = session.tenant.enabledModules ?? null
    state.moduleEntitlements = session.tenant.moduleEntitlements ?? null
  } else {
    state.tenantId = null
    state.tenant = defaultTenantBranding
    state.enabledModules = session.subscription?.enabledModules ?? null
    state.moduleEntitlements = session.subscription?.moduleEntitlements ?? null
  }
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    hydrateFromLegacyStorage(state) {
      if (state.accessToken) {
        return
      }
      const accessToken = getAccessToken()
      const tenantId = getTenantId()
      const userId = getUserId() ?? readJwtSub(accessToken)
      state.accessToken = accessToken
      state.tenantId = tenantId
      state.userId = userId
    },
    setCredentials(
      state,
      action: PayloadAction<{ accessToken: string; tenantId: string | null; userId: string }>
    ) {
      const { accessToken, tenantId, userId } = action.payload
      state.accessToken = accessToken
      state.tenantId = tenantId
      state.userId = userId
      state.loginStatus = 'succeeded'
      state.loginError = null
    },
    setSessionPayload(state, action: PayloadAction<SessionPayload>) {
      applySession(state, action.payload)
    },
    setResolvedSettings(state, action: PayloadAction<Record<string, unknown>>) {
      state.settings = action.payload
    },
    setHolderResume(state, action: PayloadAction<HolderResume>) {
      state.holderResume = action.payload
    },
    patchTenantBranding(state, action: PayloadAction<Partial<TenantBranding>>) {
      state.tenant = { ...state.tenant, ...action.payload }
    },
    clearHolderResume(state) {
      state.holderResume = null
    },
    clearCredentials(state) {
      state.accessToken = null
      state.tenantId = null
      state.userId = null
      state.userEmail = null
      state.userName = null
      state.isSubscriptionHolder = false
      state.subscription = null
      state.enabledModules = null
      state.moduleEntitlements = null
      state.permissions = []
      state.navigation = []
      state.settings = {}
      state.tenant = defaultTenantBranding
      state.holderResume = null
      state.loginStatus = 'idle'
      state.loginError = null
      clearSession()
    },
    clearLoginError(state) {
      state.loginError = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loginStatus = 'loading'
        state.loginError = null
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        const { accessToken, tenantId, userId, session } = action.payload
        state.accessToken = accessToken
        state.tenantId = tenantId
        state.userId = userId
        state.loginStatus = 'succeeded'
        state.loginError = null
        applySession(state, session)
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loginStatus = 'failed'
        state.loginError = action.payload ?? action.error.message ?? 'No se pudo iniciar sesión.'
      })
  },
})

export const {
  hydrateFromLegacyStorage,
  setCredentials,
  setSessionPayload,
  setResolvedSettings,
  setHolderResume,
  clearHolderResume,
  patchTenantBranding,
  clearCredentials,
  clearLoginError,
} = authSlice.actions

export function selectAccessToken(state: { auth: AuthState }): string | null {
  return state.auth.accessToken
}

export function selectIsAuthenticated(state: { auth: AuthState }): boolean {
  return Boolean(state.auth.accessToken)
}

export function selectLoginStatus(state: { auth: AuthState }): AuthState['loginStatus'] {
  return state.auth.loginStatus
}

export function selectLoginError(state: { auth: AuthState }): string | null {
  return state.auth.loginError
}

type AuthRootState = { auth: AuthState }

export function selectNavigation(state: AuthRootState): NavigationNode[] {
  return state.auth.navigation
}

export const selectVisibleNavigation = createSelector(
  [(state: AuthRootState) => state.auth.navigation],
  (navigation) => filterNavigationTree(navigation)
)

export function selectSettings(state: AuthRootState): Record<string, unknown> {
  return state.auth.settings
}

export function selectThemeSetting(state: AuthRootState): unknown {
  return state.auth.settings['ui.theme.default']
}

export function selectPermissions(state: { auth: AuthState }): string[] {
  return state.auth.permissions
}

export function selectEnabledModules(state: { auth: AuthState }): string[] | null {
  return state.auth.enabledModules
}

export function selectModuleEntitlements(state: { auth: AuthState }): ModuleEntitlementDto[] | null {
  return state.auth.moduleEntitlements
}

export function selectHasPermission(state: { auth: AuthState }, code: string): boolean {
  return state.auth.permissions.some((p) => p.toLowerCase() === code.toLowerCase())
}

export function selectTenantBranding(state: AuthRootState): TenantBranding {
  return state.auth.tenant ?? defaultTenantBranding
}

export function selectTenantId(state: { auth: AuthState }): string | null {
  return state.auth.tenantId
}

export function selectUserId(state: { auth: AuthState }): string | null {
  return state.auth.userId
}

export function selectUserEmail(state: { auth: AuthState }): string | null {
  return state.auth.userEmail
}

export function selectUserName(state: { auth: AuthState }): string | null {
  return state.auth.userName
}

export function selectIsSubscriptionHolder(state: { auth: AuthState }): boolean {
  return state.auth.isSubscriptionHolder
}

export function selectSubscription(state: AuthRootState): SubscriptionSessionDto | null {
  return state.auth.subscription
}

export function selectHolderResume(state: { auth: AuthState }): HolderResume | null {
  return state.auth.holderResume
}

export function selectIsCompanySession(state: { auth: AuthState }): boolean {
  return Boolean(state.auth.tenantId) && !state.auth.isSubscriptionHolder
}

export function selectCanReturnToCompanies(state: { auth: AuthState }): boolean {
  return Boolean(state.auth.holderResume && state.auth.tenantId)
}
