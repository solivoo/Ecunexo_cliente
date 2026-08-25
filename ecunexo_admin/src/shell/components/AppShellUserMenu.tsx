import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from 'glubox'
import {
  selectCanReturnToCompanies,
  selectIsCompanySession,
  selectIsSubscriptionHolder,
  selectTenantBranding,
  selectTenantId,
  selectUserEmail,
  selectUserId,
  selectUserName,
} from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { restoreHolderSessionThunk } from '@/store/thunks/authThunks'

export interface AppShellUserMenuProps {
  readonly onLogout: () => void
}

export function AppShellUserMenu({ onLogout }: AppShellUserMenuProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const toast = useToast()
  const userId = useAppSelector(selectUserId)
  const userEmail = useAppSelector(selectUserEmail)
  const userName = useAppSelector(selectUserName)
  const tenantId = useAppSelector(selectTenantId)
  const tenant = useAppSelector(selectTenantBranding)
  const isHolder = useAppSelector(selectIsSubscriptionHolder)
  const isCompany = useAppSelector(selectIsCompanySession)
  const canReturn = useAppSelector(selectCanReturnToCompanies)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const initial = (
    userName?.trim().charAt(0) ??
    userEmail?.charAt(0) ??
    userId?.charAt(0) ??
    'U'
  ).toUpperCase()

  const displayName = userName?.trim() || userEmail || 'Usuario'
  const companyLabel = tenant.name || null

  const modeLabel = isHolder && !tenantId
    ? 'Titular · todas las empresas'
    : isCompany
      ? `Empresa · ${companyLabel ?? 'activa'}`
      : 'Sesión'
  const close = useCallback(() => setOpen(false), [])

  const handleLogout = useCallback(() => {
    close()
    onLogout()
  }, [close, onLogout])

  const handleMisEmpresas = useCallback(async () => {
    close()
    if (!canReturn) {
      void navigate('/organizacion/empresas')
      return
    }
    setBusy(true)
    try {
      await dispatch(restoreHolderSessionThunk()).unwrap()
      toast.show({
        title: 'Modo titular',
        message: 'Volviste a gestionar todas tus empresas.',
        variant: 'info',
      })
      void navigate('/organizacion/empresas', { replace: true })
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo volver',
        message: typeof err === 'string' ? err : 'Cierra sesión e inicia de nuevo como titular.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [canReturn, close, dispatch, navigate, toast])

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  return (
    <div className="app-shell__user-menu" ref={rootRef}>
      <button
        type="button"
        className="app-shell__user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menú de cuenta · ${displayName}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="app-shell__user-avatar" aria-hidden>
          {initial}
        </span>
        <span className="material-symbols-outlined app-shell__user-menu-chevron" aria-hidden>
          expand_more
        </span>
      </button>
      {open ? (
        <div className="app-shell__user-menu-panel" role="menu">
          <div className="app-shell__user-menu-identity">
            <p className="app-shell__user-menu-name" title={displayName}>
              {displayName}
            </p>
            {userEmail && userEmail !== displayName ? (
              <p className="app-shell__user-menu-email" title={userEmail}>
                {userEmail}
              </p>
            ) : null}
            <p className="app-shell__user-menu-meta">{modeLabel}</p>
          </div>
          {canReturn ? (
            <button
              type="button"
              className="app-shell__user-menu-item"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                void handleMisEmpresas()
              }}
            >
              <span className="material-symbols-outlined" aria-hidden>
                apartment
              </span>
              {busy ? 'Volviendo…' : 'Mis empresas'}
            </button>
          ) : null}
          <button
            type="button"
            className="app-shell__user-menu-item"
            role="menuitem"
            onClick={handleLogout}
          >
            <span className="material-symbols-outlined" aria-hidden>
              logout
            </span>
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  )
}
