import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from 'glubox'
import {
  selectCanReturnToCompanies,
  selectIsCompanySession,
  selectIsSubscriptionHolder,
  selectTenantBranding,
  selectTenantId,
} from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { restoreHolderSessionThunk } from '@/store/thunks/authThunks'

/** Banner de modo: titular vs empresa activa + atajo a Mis empresas. */
export function SessionModeBanner() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const toast = useToast()
  const isHolder = useAppSelector(selectIsSubscriptionHolder)
  const tenantId = useAppSelector(selectTenantId)
  const tenant = useAppSelector(selectTenantBranding)
  const isCompany = useAppSelector(selectIsCompanySession)
  const canReturn = useAppSelector(selectCanReturnToCompanies)
  const [busy, setBusy] = useState(false)

  const goToCompanies = useCallback(async () => {
    if (!canReturn) {
      void navigate('/organizacion/empresas')
      return
    }
    setBusy(true)
    try {
      await dispatch(restoreHolderSessionThunk()).unwrap()
      toast.show({
        title: 'Modo titular',
        message: 'Volviste a la gestión de todas tus empresas.',
        variant: 'info',
      })
      void navigate('/organizacion/empresas', { replace: true })
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo volver',
        message: typeof err === 'string' ? err : 'Vuelve a iniciar sesión como titular.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [canReturn, dispatch, navigate, toast])

  if (isHolder && !tenantId) {
    return (
      <div className="ecu-session-banner ecu-session-banner--holder" role="status">
        <div>
          <strong>Modo titular</strong>
          <span> — Gestionas la licencia y todas las empresas. Entra a una para operar.</span>
        </div>
      </div>
    )
  }

  if (!isCompany) {
    return null
  }

  const org = tenant.name || 'Empresa'

  return (
    <div className="ecu-session-banner ecu-session-banner--company" role="status">
      <div>
        <strong>Operando: {org}</strong>
        <span> — Estás dentro de una sola empresa. Los datos y el menú son solo de esta.</span>
      </div>
      {canReturn ? (
        <button
          type="button"
          className="ecu-session-banner__action"
          disabled={busy}
          onClick={() => {
            void goToCompanies()
          }}
        >
          {busy ? 'Volviendo…' : 'Mis empresas'}
        </button>
      ) : null}
    </div>
  )
}
