import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  GridToolbarRefresh,
} from '@/components/ui'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { permissionStatusLabel } from '@/lib/enumLabels'
import { moduleLabel } from '@/lib/moduleLabels'
import { readApiError } from '@/lib/readApiError'
import { PermissionPoliciesSection } from '@/pages/security/PermissionPoliciesSection'
import { getPermission, listPermissionPolicies } from '@/services/identityApi'
import type { PermissionDetailDto, PolicyListItemDto } from '@/types/identityApi'
import './securitySection.css'

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

  const actionItems: PageActionItem[] = [
    {
      id: 'list',
      label: 'Catálogo de permisos',
      icon: 'key',
      route: '/seguridad/permisos',
      disabled: false,
    },
    { id: 'roles', label: 'Roles', icon: 'shield', route: '/equipo/roles', disabled: false },
  ]

  return (
    <div className="ecu-dashboard-layout ecu-section-page">
      <PageLoadState loading={loading && !perm} error={error} empty={!perm && !loading}>
        {perm ? (
          <>
            <PageHeader
              title={perm.displayName ?? perm.code}
              subtitle="Directiva de autorización del catálogo global."
              actions={
                <>
                  <GridToolbarRefresh
                    loading={loading}
                    onRefresh={() => void load()}
                    label="Actualizar ficha"
                  />
                  <EcuPageActions
                    items={actionItems}
                    variant="outline"
                    triggerLabel="Acciones de permiso"
                    renderIcon={renderSidebarIcon}
                    onNavigate={(route: string) => navigate(route)}
                  />
                </>
              }
            />

            <SectionCard title="Definición" bodyClassName="ecu-section-card__body--padded">
              <div className="ecu-property-grid">
                <div className="ecu-property-tile ecu-property-tile--full">
                  <span className="ecu-property-tile__label">Código técnico</span>
                  <span className="ecu-property-tile__value ecu-property-tile__value--mono">
                    {perm.code}
                  </span>
                </div>
                <div className="ecu-property-tile">
                  <span className="ecu-property-tile__label">Nombre visible</span>
                  <span className="ecu-property-tile__value">{perm.displayName ?? '—'}</span>
                </div>
                <div className="ecu-property-tile">
                  <span className="ecu-property-tile__label">Módulo</span>
                  <span className="ecu-property-tile__value">
                    {perm.module ? (
                      <span className="ecu-chip">{moduleLabel(perm.module)}</span>
                    ) : (
                      'Global'
                    )}
                  </span>
                </div>
                <div className="ecu-property-tile">
                  <span className="ecu-property-tile__label">Orden relativo</span>
                  <span className="ecu-property-tile__value">{perm.sortOrder}</span>
                </div>
                <div className="ecu-property-tile">
                  <span className="ecu-property-tile__label">Estado</span>
                  <span className="ecu-property-tile__value">
                    <span
                      className={`ecu-status ${
                        perm.status === 0 ? 'ecu-status--active' : 'ecu-status--inactive'
                      }`}
                    >
                      <span className="ecu-status__dot" aria-hidden />
                      {permissionStatusLabel(perm.status)}
                    </span>
                  </span>
                </div>
                <div className="ecu-property-tile">
                  <span className="ecu-property-tile__label">Alta</span>
                  <span className="ecu-property-tile__value">{formatDate(perm.createdAt)}</span>
                </div>
                <div className="ecu-property-tile ecu-property-tile--full">
                  <span className="ecu-property-tile__label">Descripción</span>
                  <span className="ecu-property-tile__value">
                    {perm.description ?? 'Sin descripción'}
                  </span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Políticas ABAC">
              <PermissionPoliciesSection
                permissionId={permissionId}
                policies={policies}
                loading={loading}
                canManage={canManagePolicies}
                onCreated={() => load({ silent: true })}
              />
            </SectionCard>
          </>
        ) : null}
      </PageLoadState>
    </div>
  )
}
