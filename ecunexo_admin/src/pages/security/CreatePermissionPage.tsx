import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Key } from 'lucide-react'
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
          message: `«${code.trim()}» quedó en el catálogo global.`,
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
      <div className="ecu-companies-page">
        <p className="app-shell__page-lead">
          Requieres identity.permissions.manage para crear permisos.
        </p>
        <Button type="button" variant="outline" onClick={goToList}>
          Volver al catálogo
        </Button>
      </div>
    )
  }

  return (
    <div className="ecu-companies-page">
      <div className="ecu-page-header">
        <p className="app-shell__page-lead">
          Alta de un permiso global reutilizable entre empresas.
        </p>
        <EcuPageActions
          items={actionItems}
          variant="outline"
          triggerLabel="Acciones de nuevo permiso"
          renderIcon={renderSidebarIcon}
          onNavigate={(route: string) => navigate(route)}
        />
      </div>

      <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <section className="app-shell__card ecu-companies-form__card">
          <h2 className="app-shell__section-title">
            <Key size={18} strokeWidth={1.75} aria-hidden /> Permiso
          </h2>
          <p className="ecu-companies-form__hint">
            El código identifica la acción en RBAC (ej. identity.users.read). El módulo se guarda
            en minúsculas (identity, catalog, facturacion). Las políticas ABAC se definen después
            en la ficha.
          </p>
          <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
            <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
              <TextBox
                id="perm-code"
                label="Código"
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
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={busy || !code.trim()}
          >
            Crear
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
