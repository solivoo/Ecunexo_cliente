import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Building2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { createTenantDepartment } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function CreateDepartmentPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('identity.departments.manage')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const goToList = useCallback(() => {
    void navigate('/equipo/departamentos')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Listado de departamentos',
        icon: 'building-2',
        route: '/equipo/departamentos',
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
        if (!name.trim()) throw new Error('El nombre del departamento es obligatorio.')

        await createTenantDepartment(tenantId, {
          name: name.trim(),
          description: description.trim() || null,
        })

        toast.show({
          title: 'Departamento creado',
          message: `«${name.trim()}» ya está disponible para asignar a usuarios.`,
          variant: 'success',
        })
        void navigate('/equipo/departamentos', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : readApiError(err, 'No se pudo crear el departamento.')
        setError(message)
        toast.show({ title: 'No se pudo crear', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [description, name, navigate, tenantId, toast]
  )

  if (!canManage) {
    return (
      <TenantSessionGate
        title="Nuevo departamento"
        lead="Alta de una unidad organizacional en la empresa."
      >
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres identity.departments.manage para crear departamentos.
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
      title="Nuevo departamento"
      lead="Alta de una unidad organizacional en la empresa."
    >
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            El nombre debe ser único en la empresa. Luego podrás asignarlo a usuarios.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de crear departamento"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        </div>

        {error ? (
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
                  id="cd-name"
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
                  id="cd-desc"
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
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={goToList}
            >
              Atrás
            </Button>
          </div>
        </form>
      </div>
    </TenantSessionGate>
  )
}
