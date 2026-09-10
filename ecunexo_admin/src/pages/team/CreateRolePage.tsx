import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { Shield } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { createTenantRole } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function CreateRolePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('identity.roles.manage')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSystem, setIsSystem] = useState(false)

  const goToList = useCallback(() => {
    void navigate('/equipo/roles')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Listado de roles',
        icon: 'shield',
        route: '/equipo/roles',
        disabled: false,
      },
      {
        id: 'users',
        label: 'Usuarios',
        icon: 'users',
        route: '/equipo/usuarios',
        disabled: false,
      },
    ],
    []
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre del rol es obligatorio.')

        const res = await createTenantRole(tenantId, {
          name: name.trim(),
          description: description.trim() || null,
          isSystem,
        })

        toast.show({
          title: 'Rol creado',
          message: `«${name.trim()}» quedó registrado. Ahora elige sus permisos.`,
          variant: 'success',
        })
        void navigate(`/equipo/roles/${res.roleId}/permisos`, { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo crear el rol.')
        setError(message)
        toast.show({ title: 'No se pudo crear', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [description, isSystem, name, navigate, tenantId, toast]
  )

  if (!canManage) {
    return (
      <TenantSessionGate title="Nuevo rol" lead="Alta de un rol RBAC en la empresa.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres identity.roles.manage para crear roles.
          </p>
          <Button type="button" variant="outline" onClick={goToList}>
            Volver al listado
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Nuevo rol" lead="Alta de un rol RBAC en la empresa.">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Nuevo Rol"
          subtitle="Define un nuevo perfil de seguridad. Luego de crearlo podrás vincular directivas y permisos del catálogo."
          badge={
            <StatusBadge tone="primary" withDot>
              Configuración RBAC
            </StatusBadge>
          }
          actions={
            <>
              <Button type="button" variant="outline" onClick={goToList}>
                Volver a Roles
              </Button>
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
              />
            </>
          }
        />

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} strokeWidth={1.75} aria-hidden /> Datos del Rol
              </span>
            }
            subtitle="El nombre identifica el rol en las asignaciones de usuarios. La descripción aclara su alcance."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="cr-name"
                  label="Nombre del rol"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="cr-desc"
                  label="Descripción"
                  labelPosition="outlined"
                  variant="outline"
                  value={description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <label className="ecu-inline-check">
                  <input
                    type="checkbox"
                    checked={isSystem}
                    disabled={busy}
                    onChange={(e) => setIsSystem(e.target.checked)}
                  />
                  <span>Rol de sistema (protegido contra eliminación)</span>
                </label>
                <p className="ecu-companies-form__hint">
                  Los roles de sistema suelen reservarse para administración base de la plataforma.
                </p>
              </div>
            </div>
          </SectionCard>

          <div className="ecu-companies-form__actions">
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>
              Guardar y Configurar Permisos
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={goToList}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </TenantSessionGate>
  )
}
