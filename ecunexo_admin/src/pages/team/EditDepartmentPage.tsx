import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Popup, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { Building2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import {
  deleteTenantDepartment,
  getTenantDepartment,
  updateTenantDepartment,
} from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

const LIST_PATH = '/equipo/departamentos'

export function EditDepartmentPage() {
  const { departmentId = '' } = useParams<{ departmentId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('identity.departments.manage')

  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const isAdministration = useMemo(() => {
    const trimmed = name.trim().toLowerCase()
    return trimmed === 'administración' || trimmed === 'administracion'
  }, [name])

  const handleDelete = useCallback(async () => {
    if (!tenantId || !departmentId) return
    setDeleteBusy(true)
    try {
      await deleteTenantDepartment(tenantId, departmentId)
      toast.show({
        title: 'Departamento eliminado',
        message: `Se eliminó el departamento «${name.trim()}».`,
        variant: 'success',
      })
      setConfirmDelete(false)
      void navigate(LIST_PATH, { replace: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No se pudo eliminar el departamento.'),
        variant: 'error',
      })
    } finally {
      setDeleteBusy(false)
    }
  }, [departmentId, name, navigate, tenantId, toast])

  const goToList = useCallback(() => {
    void navigate(LIST_PATH)
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Listado de departamentos',
        icon: 'building-2',
        route: LIST_PATH,
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

  const load = useCallback(async () => {
    if (!tenantId || !departmentId) return
    setLoading(true)
    try {
      const row = await getTenantDepartment(tenantId, departmentId)
      setName(row.name)
      setDescription(row.description ?? '')
      setHydrated(true)
      setError(null)
    } catch (err: unknown) {
      setHydrated(false)
      setError(readApiError(err, 'No se pudo cargar el departamento.'))
    } finally {
      setLoading(false)
    }
  }, [departmentId, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !departmentId) return
      if (!name.trim()) {
        setError('El nombre del departamento es obligatorio.')
        return
      }

      setError(null)
      setBusy(true)
      try {
        await updateTenantDepartment(tenantId, departmentId, {
          name: name.trim(),
          description: description.trim() || null,
        })
        toast.show({
          title: 'Departamento actualizado',
          message: `Se guardó «${name.trim()}». Los usuarios asignados ya ven el nombre nuevo.`,
          variant: 'success',
        })
        void navigate(LIST_PATH, { replace: true })
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo guardar el departamento.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [departmentId, description, name, navigate, tenantId, toast]
  )

  if (!canManage) {
    return (
      <TenantSessionGate
        title="Editar departamento"
        lead="Corrige el nombre o la descripción de la unidad organizacional."
      >
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres identity.departments.manage para editar departamentos.
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
      title="Editar departamento"
      lead="Corrige el nombre o la descripción. El identificador no cambia."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title={name ? `Editar Área: ${name}` : 'Editar Departamento'}
          subtitle="Modifica el nombre o descripción del departamento. Los usuarios asignados conservarán su vinculación."
          badge={
            <StatusBadge tone="primary" withDot>
              Unidad Organizacional
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
                Volver a Departamentos
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
                  <Building2 size={18} strokeWidth={1.75} aria-hidden /> Propiedades del Departamento
                </span>
              }
              subtitle="El nombre es único en esta empresa. Puedes corregir ortografía y tildes libremente."
            >
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="ed-name"
                    label="Nombre del departamento"
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
                    id="ed-desc"
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
              {!isAdministration ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || loading || deleteBusy}
                  onClick={() => setConfirmDelete(true)}
                  style={{ marginLeft: 'auto', color: 'var(--glb-danger, #dc2626)' }}
                >
                  Eliminar Departamento
                </Button>
              ) : null}
            </div>
          </form>
        </PageLoadState>
      </div>

      <Popup
        open={confirmDelete}
        title="Eliminar departamento"
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
          ¿Dar de baja el departamento <strong>{name}</strong>? Los usuarios que lo tuvieran
          asignado deben ser reasignados previamente.
        </p>
      </Popup>
    </TenantSessionGate>
  )
}
