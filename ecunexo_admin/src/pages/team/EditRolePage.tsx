import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Popup, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { Shield } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { deleteTenantRole, getTenantRole, updateTenantRole } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantRoleDto } from '@/types/identityApi'

const LIST_PATH = '/equipo/roles'

export function EditRolePage() {
  const { roleId = '' } = useParams<{ roleId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('identity.roles.manage')

  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<GetTenantRoleDto | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!tenantId || !roleId) return
    setDeleteBusy(true)
    try {
      await deleteTenantRole(tenantId, roleId)
      toast.show({
        title: 'Rol eliminado',
        message: `Se eliminó el rol «${name.trim()}».`,
        variant: 'success',
      })
      setConfirmDelete(false)
      void navigate(LIST_PATH, { replace: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No se pudo eliminar el rol.'),
        variant: 'error',
      })
    } finally {
      setDeleteBusy(false)
    }
  }, [name, navigate, roleId, tenantId, toast])

  const goToList = useCallback(() => {
    void navigate(LIST_PATH)
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = [
      {
        id: 'list',
        label: 'Listado de roles',
        icon: 'shield',
        route: LIST_PATH,
        disabled: false,
      },
    ]
    if (roleId) {
      items.push(
        {
          id: 'detail',
          label: 'Ver rol',
          icon: 'eye',
          route: `/equipo/roles/${roleId}`,
          disabled: false,
        },
        {
          id: 'perms',
          label: 'Gestionar permisos',
          icon: 'key',
          route: `/equipo/roles/${roleId}/permisos`,
          disabled: false,
        }
      )
    }
    return items
  }, [roleId])

  const load = useCallback(async () => {
    if (!tenantId || !roleId) return
    setLoading(true)
    try {
      const data = await getTenantRole(tenantId, roleId)
      setRole(data)
      setName(data.name)
      setDescription(data.description ?? '')
      setHydrated(true)
      setError(null)
    } catch (err: unknown) {
      setHydrated(false)
      setError(readApiError(err, 'No se pudo cargar el rol.'))
    } finally {
      setLoading(false)
    }
  }, [roleId, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !roleId) return
      if (!name.trim()) {
        setError('El nombre del rol es obligatorio.')
        return
      }

      setError(null)
      setBusy(true)
      try {
        await updateTenantRole(tenantId, roleId, {
          name: name.trim(),
          description: description.trim() || null,
        })
        toast.show({
          title: 'Rol actualizado',
          message: `Se guardó «${name.trim()}».`,
          variant: 'success',
        })
        void navigate(`/equipo/roles/${roleId}`, { replace: true })
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo guardar el rol.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [description, name, navigate, roleId, tenantId, toast]
  )

  if (!canManage) {
    return (
      <TenantSessionGate
        title="Editar rol"
        lead="Corrige el nombre o la descripción del rol."
      >
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres identity.roles.manage para editar roles.
          </p>
          <Button type="button" variant="outline" onClick={goToList}>
            Volver al listado
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Editar rol"
      lead="Corrige el nombre o la descripción. El identificador y permisos vinculados no cambian."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title={name ? `Editar Rol: ${name}` : 'Editar Rol'}
          subtitle="Modifica el nombre y descripción del rol. Los permisos vinculados se mantienen intactos."
          badge={
            <StatusBadge tone={role?.isSystem ? 'success' : 'primary'} withDot>
              {role?.isSystem ? 'Rol de Sistema' : 'Edición de Rol'}
            </StatusBadge>
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={goToList}
                disabled={busy || deleteBusy}
              >
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

        <PageLoadState
          loading={loading}
          error={!hydrated ? error : null}
          empty={false}
        >
          {hydrated && error ? (
            <p className="welcome-onboarding__error" role="alert">
              {error}
            </p>
          ) : null}
          <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
            <SectionCard
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} strokeWidth={1.75} aria-hidden /> Propiedades del Rol
                </span>
              }
              subtitle={
                role?.isSystem
                  ? 'Este es un rol protegido de sistema. Puedes actualizar su descripción para tu organización.'
                  : 'Modifica el nombre y la descripción descriptiva del perfil.'
              }
            >
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="er-name"
                    label="Nombre del rol"
                    labelPosition="outlined"
                    variant="outline"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    required
                    disabled={busy || role?.isSystem}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="er-desc"
                    label="Descripción"
                    labelPosition="outlined"
                    variant="outline"
                    value={description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                    disabled={busy}
                    fullWidth
                  />
                </div>
              </div>
            </SectionCard>

            <div className="ecu-companies-form__actions">
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                disabled={busy || loading || deleteBusy}
              >
                Guardar Cambios
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || deleteBusy}
                onClick={goToList}
              >
                Cancelar
              </Button>
              {!role?.isSystem ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || deleteBusy}
                  onClick={() => setConfirmDelete(true)}
                  style={{ marginLeft: 'auto', color: 'var(--glb-danger, #dc2626)' }}
                >
                  Eliminar Rol
                </Button>
              ) : null}
            </div>
          </form>
        </PageLoadState>
      </div>

      <Popup
        open={confirmDelete}
        title="Eliminar rol"
        onClose={() => setConfirmDelete(false)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDelete(false),
            disabled: deleteBusy,
          },
          {
            id: 'confirm',
            label: 'Sí, eliminar',
            variant: 'primary',
            onClick: () => {
              void handleDelete()
            },
            disabled: deleteBusy,
          },
        ]}
      >
        <p className="app-shell__muted">
          ¿Dar de baja el rol <strong>{name}</strong>? Los usuarios que lo tuvieran asignado deben
          ser reasignados previamente.
        </p>
      </Popup>
    </TenantSessionGate>
  )
}
