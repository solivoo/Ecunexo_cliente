import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { moduleKey } from '@/lib/moduleLabels'
import { createPermission } from '@/services/identityApi'

export function CreatePermissionPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const canManage = useHasPermission('identity.permissions.manage')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [module, setModule] = useState('')
  const [description, setDescription] = useState('')

  const goToList = useCallback(() => {
    void navigate('/seguridad/permisos')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Catálogo de permisos',
        icon: 'key',
        route: '/seguridad/permisos',
        disabled: false,
      },
      {
        id: 'roles',
        label: 'Roles',
        icon: 'shield',
        route: '/equipo/roles',
        disabled: false,
      },
    ],
    []
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      setError(null)
      setBusy(true)
      try {
        if (!code.trim()) throw new Error('El código del permiso es obligatorio.')

        const res = await createPermission({
          code: code.trim(),
          displayName: displayName.trim() || null,
          module: moduleKey(module) || null,
          description: description.trim() || null,
          sortOrder: 0,
        })

        toast.show({
          title: 'Permiso creado',
          message: `«${code.trim()}» quedó registrado en el catálogo global.`,
          variant: 'success',
        })
        void navigate(`/seguridad/permisos/${res.permissionId}`, { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo crear el permiso.')
        setError(message)
        toast.show({ title: 'No se pudo crear', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [code, description, displayName, module, navigate, toast]
  )

  if (!canManage) {
    return (
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Acceso Restringido"
          subtitle="Requieres el permiso identity.permissions.manage para dar de alta directivas de autorización."
          badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
        />
        <SectionCard title="Permisos insuficientes">
          <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
            No dispones de privilegios de gestión sobre el catálogo global de permisos.
          </p>
          <Button type="button" variant="outline" onClick={goToList}>
            Volver al catálogo
          </Button>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title="Nuevo Permiso"
        subtitle="Registra una nueva directiva en el catálogo global de permisos reutilizable por todas las entidades."
        badge={
          <StatusBadge tone="primary" withDot>
            Catálogo Global
          </StatusBadge>
        }
        actions={
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de nuevo permiso"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        }
      />

      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <SectionCard
          title="Definición de la Directiva"
          subtitle="El código jerárquico identifica la capacidad en RBAC. El módulo se guarda en minúsculas. Las políticas condicionales ABAC se pueden añadir posteriormente en la ficha."
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
            <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
              <TextBox
                id="perm-code"
                label="Código de la directiva"
                labelPosition="outlined"
                variant="outline"
                value={code}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
                placeholder="modulo.recurso.accion"
                disabled={busy}
                fullWidth
              />
            </div>
            <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
              <TextBox
                id="perm-name"
                label="Nombre visible"
                labelPosition="outlined"
                variant="outline"
                value={displayName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                placeholder="Ej. Crear usuarios"
                disabled={busy}
                fullWidth
              />
            </div>
            <div className="ecu-companies-form__field">
              <TextBox
                id="perm-module"
                label="Módulo"
                labelPosition="outlined"
                variant="outline"
                value={module}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setModule(e.target.value.toLowerCase())
                }
                placeholder="identity"
                disabled={busy}
                fullWidth
              />
            </div>
            <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
              <TextBox
                id="perm-desc"
                label="Descripción funcional"
                labelPosition="outlined"
                variant="outline"
                value={description}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                placeholder="Describe el alcance y límites de esta directiva…"
                disabled={busy}
                fullWidth
              />
            </div>
          </div>

          <div
            className="ecu-companies-form__actions"
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
            }}
          >
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={busy || !code.trim()}
            >
              Crear Permiso
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
              Cancelar
            </Button>
          </div>
        </SectionCard>
      </form>
    </div>
  )
}
