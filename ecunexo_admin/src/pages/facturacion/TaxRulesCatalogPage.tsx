import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from 'glubox'
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { TaxRuleKindCard } from '@/pages/facturacion/TaxRuleKindCard'
import {
  groupRulesByKind,
  type CreateTaxRuleBody,
  type TaxRuleRow,
} from '@/pages/facturacion/taxRuleCatalog'
import { createTaxRule, listTaxRules } from '@/services/billingCatalogApi'
import '@/pages/contabilidad/sriConfig.css'
import './taxRulesCatalog.css'

function writeErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { errors?: string[] } } }).response?.data
    if (data?.errors?.length) return data.errors.join(' ')
  }
  return readApiError(error, 'No se pudo guardar la regla. ¿Billing.Api (:5203) está en marcha?')
}

export function TaxRulesCatalogPage() {
  const toast = useToast()
  const canRead = useHasPermission('facturacion.catalogos.read')
  const canWrite = useHasPermission('facturacion.catalogos.write')
  const [rows, setRows] = useState<readonly TaxRuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listTaxRules())
      setError(null)
    } catch (err: unknown) {
      setRows([])
      setError(readApiError(err, 'No se pudo leer el catálogo de reglas en Billing.Api (:5203).'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canRead) void load()
    else setLoading(false)
  }, [canRead, load])

  const kinds = useMemo(() => groupRulesByKind(rows), [rows])

  const onSubmit = useCallback(
    async (body: CreateTaxRuleBody) => {
      setBusy(true)
      try {
        const result = await createTaxRule(body)
        if (result.errors.length > 0) {
          toast.show({ title: 'No se guardó', message: result.errors.join(' '), variant: 'error' })
          return
        }
        toast.show({
          title: result.skipped > 0 ? 'Sin cambios' : 'Vigencia registrada',
          message:
            result.skipped > 0
              ? 'Ya existía una regla con esa fecha de inicio.'
              : 'La vigencia anterior quedó cerrada. Las facturas usarán el nuevo plazo.',
          variant: result.skipped > 0 ? 'info' : 'success',
        })
        await load()
      } catch (err: unknown) {
        toast.show({ title: 'No se pudo guardar', message: writeErrorMessage(err), variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [load, toast]
  )

  if (!canRead) {
    return (
      <TenantSessionGate
        title="Reglas SRI"
        lead="Entra a una empresa para ver el catálogo de políticas tributarias."
      >
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres facturacion.catalogos.read para consultar las reglas tributarias del SRI."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Reglas SRI"
      lead="Catálogo unificado de políticas tributarias y vigencias normativas del SRI."
    >
      <div className="ecu-dashboard-layout tax-rules-catalog">
        <PageHeader
          title="Reglas y Catálogos SRI"
          subtitle="Políticas tributarias y vigencias normativas dictadas por el SRI (plazos de transmisión, retenciones, tarifas). Cada grupo se administra de forma histórica."
          badge={
            <StatusBadge tone="primary" withDot>
              {kinds.length} {kinds.length === 1 ? 'Grupo' : 'Grupos'}
            </StatusBadge>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de reglas">
          <StatCard
            label="Grupos Normativos"
            value={kinds.length}
            icon="policy"
            toneColor="#4f46e5"
            footerText="Tipos de políticas fiscales"
          />
          <StatCard
            label="Vigencias Registradas"
            value={rows.length}
            icon="rule"
            toneColor="#10b981"
            footerText="Reglas activas e históricas"
          />
          <StatCard
            label="Servicio de Facturación"
            value="Billing API"
            icon="cloud_done"
            toneColor="#0ea5e9"
            footerText="Motor tributario conectado"
          />
        </div>

        <SectionCard
          title="Políticas Tributarias Vigentes"
          subtitle="Esquemas de validación normativa y vigencias aplicadas en la emisión de comprobantes"
        >
          <PageLoadState
            loading={loading}
            error={error}
            empty={kinds.length === 0}
            emptyMessage="Aún no hay reglas configuradas en el motor tributario."
          >
            <div className="tax-rules-catalog__kinds sri-config-page">
              {kinds.map((kind) => (
                <TaxRuleKindCard
                  key={kind.code}
                  kind={kind}
                  canWrite={canWrite}
                  busy={busy}
                  onSubmit={onSubmit}
                />
              ))}
            </div>
          </PageLoadState>
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
