import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from 'glubox'
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

  return (
    <TenantSessionGate
      title="Reglas SRI"
      lead="Entra a una empresa para ver el catálogo de políticas tributarias."
    >
      <div className="ecu-companies-page tax-rules-catalog">
        <div className="ecu-page-header">
          <div>
            <h1 className="app-shell__page-title">Reglas SRI</h1>
            <p className="app-shell__page-lead">
              Cada tarjeta es un tipo de política. Si el SRI publica otra (plazos, retenciones,
              etc.), aparece como una tarjeta más: no se mezclan en una sola tabla.
            </p>
          </div>
        </div>

        {!canRead ? (
          <p>Sin permiso para ver catálogos de facturación.</p>
        ) : (
          <PageLoadState
            loading={loading}
            error={error}
            empty={kinds.length === 0}
            emptyMessage="Aún no hay reglas en Billing.Api (:5203)."
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
        )}
      </div>
    </TenantSessionGate>
  )
}
