import { useEffect, useRef } from 'react'
import { fetchSession, fetchSubscriptionSession } from '@/services/authApi'
import {
  selectAccessToken,
  selectIsAuthenticated,
  selectTenantId,
  setSessionPayload,
} from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'

/**
 * Refresca permisos y menú desde GET /session.
 * Con redux-persist el menú ya está en store; esto actualiza en segundo plano.
 */
export function SessionBootstrap() {
  const dispatch = useAppDispatch()
  const authed = useAppSelector(selectIsAuthenticated)
  const tenantId = useAppSelector(selectTenantId)
  const token = useAppSelector(selectAccessToken)
  const refreshedRef = useRef(false)

  useEffect(() => {
    if (!authed || !token || refreshedRef.current) {
      return
    }

    refreshedRef.current = true
    let cancelled = false

    void (async () => {
      try {
        const session = tenantId
          ? await fetchSession(tenantId)
          : await fetchSubscriptionSession()
        if (!cancelled) {
          dispatch(setSessionPayload(session))
        }
      } catch {
        /* 401 manejado por apiClient; menú persistido sigue visible hasta clear */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authed, dispatch, tenantId, token])

  return null
}
