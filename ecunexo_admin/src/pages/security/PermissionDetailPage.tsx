import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Key, Shield } from 'lucide-react'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
import { permissionStatusLabel } from '@/lib/enumLabels'
import { moduleLabel } from '@/lib/moduleLabels'
import { readApiError } from '@/lib/readApiError'
import { PermissionPoliciesSection } from '@/pages/security/PermissionPoliciesSection'
import { getPermission, listPermissionPolicies } from '@/services/identityApi'
import type { PermissionDetailDto, PolicyListItemDto } from '@/types/identityApi'

export function PermissionDetailPage() {
  const { permissionId = '' } = useParams<{ permissionId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const canManagePolicies = useHasPermission('identity.policies.manage')

  const [perm, setPerm] = useState<PermissionDetailDto | null>(null)
  const [policies, setPolicies] = useState<PolicyListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setLoading(true)
      try {
        const p = await getPermission(permissionId)
        setPerm(p)
        setPolicies(canManagePolicies ? await listPermissionPolicies(permissionId) : [])
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Ficha de permiso sincronizada.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar el permiso.')
        setError(message)
        setPerm(null)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [canManagePolicies, permissionId, toast]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Catálogo de permisos',
        icon: 'key',
        route: '/seguridad/permisos',
        disabled: false,
      },
      { id: 'roles', label: 'Roles', icon: 'shield', route: '/equipo/roles', disabled: false },
      { id: 'refresh', label: 'Actualizar', icon: 'refresh-cw', route: null, disabled: loading },
    ],
    [loading]
  )

  return (
    <div className="ecu-companies-page">
      <PageLoadState loading={loading && !perm} error={error} empty={!perm && !loading}>
        {perm ? (
          <>
            <div className="ecu-page-header">
              <div>
                <p className="app-shell__page-lead">
                  <strong>{perm.displayName ?? perm.code}</strong>
                  {' · '}
                  <code className="ecu-code">{perm.code}</code>
                </p>
                <p className="ecu-companies-form__hint">
                  Las políticas se definen en el permiso, no en el rol. El rol solo elige qué
                  permisos hereda.
                </p>
              </div>
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de permiso"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={(item) => {
                  if (item.id === 'refresh') void load()
                }}
              />
            </div>

            <div className="ecu-companies-page__metrics" aria-label="Resumen del permiso">
              <article className="ecu-companies-page__metric">
                <p className="ecu-companies-page__metric-label">Políticas</p>
                <p className="ecu-companies-page__metric-value">{policies.length}</p>
              </article>
              <article className="ecu-companies-page__metric">
                <p className="ecu-companies-page__metric-label">Estado</p>
                <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                  {permissionStatusLabel(perm.status)}
                </p>
              </article>
              <article className="ecu-companies-page__metric">
                <p className="ecu-companies-page__metric-label">Módulo</p>
                <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                  {perm.module ? moduleLabel(perm.module) : '—'}
                </p>
              </article>
              <article className="ecu-companies-page__metric">
                <p className="ecu-companies-page__metric-label">Alta</p>
                <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                  {formatDateTime(perm.createdAt)}
                </p>
              </article>
            </div>

            <section className="app-shell__card ecu-companies-form__card">
              <h2 className="app-shell__section-title">
                <Key size={18} strokeWidth={1.75} aria-hidden /> Permiso
              </h2>
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <p className="ecu-companies-form__hint">Código</p>
                  <p>
                    <code className="ecu-code">{perm.code}</code>
                  </p>
                </div>
                <div className="ecu-companies-form__field">
                  <p className="ecu-companies-form__hint">Nombre</p>
                  <p>{perm.displayName ?? '—'}</p>
                </div>
                <div className="ecu-companies-form__field">
                  <p className="ecu-companies-form__hint">Orden</p>
                  <p>{perm.sortOrder}</p>
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-4">
                  <p className="ecu-companies-form__hint">Descripción</p>
                  <p>{perm.description ?? '—'}</p>
                </div>
              </div>
            </section>

            <section className="app-shell__card ecu-companies-form__card">
              <h2 className="app-shell__section-title">
                <Shield size={18} strokeWidth={1.75} aria-hidden /> Políticas ABAC
              </h2>
              <p className="ecu-companies-form__hint">
                Allow = permitir si la condición es verdadera. Deny = denegar si es verdadera.
                Condición vacía = siempre. Variable: <code>ctx</code>.
              </p>
              <PermissionPoliciesSection
                permissionId={permissionId}
                policies={policies}
                loading={loading}
                canManage={canManagePolicies}
                onCreated={() => load({ silent: true })}
              />
            </section>
          </>
        ) : null}
      </PageLoadState>
    </div>
  )
}
