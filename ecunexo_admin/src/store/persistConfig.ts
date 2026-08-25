import { persistStorage } from '@/lib/persistStorage'
import type { AuthState } from '@/store/authSlice'

/** Campos de sesión que deben sobrevivir al F5 (menú, permisos, credenciales). */
export const authPersistConfig = {
  key: 'ecunexo-tenant-auth',
  storage: persistStorage,
  version: 5,
  whitelist: [
    'accessToken',
    'tenantId',
    'userId',
    'userEmail',
    'userName',
    'isSubscriptionHolder',
    'subscription',
    'tenant',
    'enabledModules',
    'moduleEntitlements',
    'permissions',
    'navigation',
    'settings',
    'holderResume',
  ] satisfies (keyof AuthState)[],
}
