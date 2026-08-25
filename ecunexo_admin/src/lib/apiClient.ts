import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { Store } from '@reduxjs/toolkit'
import { clearCredentials } from '@/store/authSlice'
import { beginRequest, clearHttpMessage, endRequest, setHttpMessage } from '@/store/uiSlice'
import { logger } from './logger'
import type { RootState } from '@/store'

/** Auth explícita por petición (antes de persistir en Redux o al cambiar de plano). */
export type ApiSessionAuth = {
  accessToken: string
  tenantId: string | null
  userId: string
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Si está definido, no se inyecta el token/tenant del store. */
    ecuAuth?: ApiSessionAuth
  }
}

let storeRef: Store<RootState> | null = null

export function configureApiClient(store: Store<RootState>): void {
  storeRef = store
}

function getStore(): Store<RootState> {
  if (!storeRef) {
    throw new Error('configureApiClient(store) debe ejecutarse antes de usar el cliente HTTP.')
  }
  return storeRef
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL?.trim() ?? '',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

function isAnonymousRoute(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/onboarding/')
}

function applySessionAuth(config: InternalAxiosRequestConfig, auth: ApiSessionAuth): void {
  config.headers.Authorization = `Bearer ${auth.accessToken}`
  config.headers['X-EcuNexo-User-Id'] = auth.userId
  if (auth.tenantId) {
    config.headers['X-EcuNexo-Tenant-Id'] = auth.tenantId
  } else {
    config.headers.delete('X-EcuNexo-Tenant-Id')
  }
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const store = getStore()
    store.dispatch(beginRequest())
    store.dispatch(clearHttpMessage())

    const url = config.url ?? ''

    if (config.ecuAuth) {
      applySessionAuth(config, config.ecuAuth)
    } else if (!isAnonymousRoute(url)) {
      const { accessToken, tenantId, userId } = store.getState().auth
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
      if (tenantId) {
        config.headers['X-EcuNexo-Tenant-Id'] = tenantId
      } else {
        config.headers.delete('X-EcuNexo-Tenant-Id')
      }
      if (userId) {
        config.headers['X-EcuNexo-User-Id'] = userId
      }
    }

    if (config.data instanceof FormData) {
      config.headers.delete('Content-Type')
    }

    logger.debug('API req', { method: config.method?.toUpperCase(), url: config.url })
    return config
  },
  (error: AxiosError) => {
    try {
      getStore().dispatch(endRequest())
    } catch {
      /* store no configurado */
    }
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    getStore().dispatch(endRequest())
    logger.debug('API res', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
    })
    return response
  },
  (error: AxiosError<ProblemBody>) => {
    const store = getStore()
    store.dispatch(endRequest())

    const status = error.response?.status
    const data = error.response?.data
    const url = error.config?.url ?? '(sin url)'
    const method = error.config?.method?.toUpperCase() ?? '?'

    logger.error('API error', { method, url, status, message: error.message })

    if (status === 401) {
      store.dispatch(clearCredentials())
      store.dispatch(setHttpMessage('Sesión expirada o no válida. Inicia sesión de nuevo.'))
      /* RequireAuth redirige al login vía React Router; evitar window.location.assign (bucle de navegación). */
    } else if (status === 403) {
      store.dispatch(
        setHttpMessage(data?.detail ?? data?.title ?? 'No tienes permiso para realizar esta acción.')
      )
    } else if (status === 429) {
      store.dispatch(setHttpMessage('Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.'))
    } else if (error.code === 'ECONNABORTED') {
      store.dispatch(setHttpMessage('La solicitud tardó demasiado. Revisa tu conexión.'))
    } else if (!error.response) {
      store.dispatch(setHttpMessage('No hay conexión con el servidor. Comprueba la Api en el puerto 5088.'))
    } else if (status && status >= 500) {
      store.dispatch(setHttpMessage('Error en el servidor. Intenta más tarde.'))
    }

    return Promise.reject(error)
  }
)

type ProblemBody = {
  title?: string
  detail?: string
}
