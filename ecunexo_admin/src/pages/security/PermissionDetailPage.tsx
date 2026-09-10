import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
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
    <div className="ecu-dashboard-layout">
      <PageLoadState loading={loading && !perm} error={error} empty={!perm && !loading}>
        {perm ? (
          <>
            <PageHeader
              title={perm.displayName ?? perm.code}
              subtitle={`Código de directiva: ${perm.code} · Las políticas ABAC se definen aquí; los roles eligen qué permisos heredar.`}
              badge={
                <StatusBadge
                  tone={perm.status === 0 ? 'success' : 'neutral'}
                  withDot={perm.status === 0}
                >
                  {permissionStatusLabel(perm.status)}
                </StatusBadge>
              }
              actions={
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
              }
            />

            <div className="ecu-stat-grid" aria-label="Resumen del permiso">
              <StatCard
                label="Políticas ABAC"
                value={policies.length}
                icon="policy"
                toneColor="#4f46e5"
                footerText="Reglas contextuales"
              />
              <StatCard
                label="Estado"
                value={permissionStatusLabel(perm.status)}
                icon="verified_user"
                toneColor={perm.status === 0 ? '#10b981' : '#6b7280'}
                footerText="Disponibilidad global"
              />
              <StatCard
                label="Módulo"
                value={perm.module ? moduleLabel(perm.module) : 'Global'}
                icon="view_quilt"
                toneColor="#0ea5e9"
                footerText="Contexto funcional"
              />
              <StatCard
                label="Fecha de Alta"
                value={formatDateTime(perm.createdAt)}
                icon="calendar_today"
                toneColor="#8b5cf6"
                footerText="Registro en plataforma"
              />
            </div>

            <SectionCard
              title="Definición del Permiso"
              subtitle="Parámetros técnicos e identificación en el modelo de control de acceso"
            >
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <p className="ecu-companies-form__hint">Código técnico</p>
                  <p>
                    <code className="ecu-code">{perm.code}</code>
                  </p>
                </div>
                <div className="ecu-companies-form__field">
                  <p className="ecu-companies-form__hint">Nombre visible</p>
                  <p style={{ fontWeight: 500 }}>{perm.displayName ?? '—'}</p>
                </div>
                <div className="ecu-companies-form__field">
                  <p className="ecu-companies-form__hint">Orden relativo</p>
                  <p>{perm.sortOrder}</p>
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-4">
                  <p className="ecu-companies-form__hint">Descripción funcional</p>
                  <p className="app-shell__muted">{perm.description ?? 'Sin descripción'}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Políticas de Control de Acceso (ABAC)"
              subtitle="Reglas evaluadas dinámicamente según el contexto de la petición"
            >
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
