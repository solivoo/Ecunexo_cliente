import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Building2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { getTenantDepartment, updateTenantDepartment } from '@/services/identityApi'
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
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Puedes poner la tilde que faltó. El nombre sigue siendo único en la empresa.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de editar departamento"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        </div>

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
            <section className="app-shell__card ecu-companies-form__card">
              <h2 className="app-shell__section-title">
                <Building2 size={18} strokeWidth={1.75} aria-hidden /> Departamento
              </h2>
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="ed-name"
                    label="Nombre"
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
            </section>

            <div className="ecu-companies-form__actions">
              <Button type="submit" variant="primary" loading={busy} disabled={busy || loading}>
                Guardar
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
                Atrás
              </Button>
            </div>
          </form>
        </PageLoadState>
      </div>
    </TenantSessionGate>
  )
}
