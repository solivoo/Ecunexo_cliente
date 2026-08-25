import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'glubox'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { ComprobantesTypeFilters } from '@/pages/facturacion/ComprobantesTypeFilters'
import { FacturasGrid } from '@/pages/facturacion/FacturasGrid'
import { useBillingInvoices } from '@/pages/facturacion/useBillingInvoices'

const STATE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'Authorized', label: 'Autorizadas' },
  { value: 'Returned', label: 'Devueltas' },
  { value: 'NotAuthorized', label: 'No autorizadas' },
  { value: 'pending', label: 'Pendientes' },
] as const

type SriFilter = (typeof STATE_OPTIONS)[number]['value']

function isPending(state: string): boolean {
  return (
    state === 'Draft' ||
    state === 'Signed' ||
    state === 'PendingReception' ||
    state === 'Received' ||
    state === 'Processing'
  )
}

export function SriMonitorPage() {
  const navigate = useNavigate()
  const canRead = useHasPermission('facturacion.sri.read')
  const canOperate = useHasPermission('facturacion.facturas.create')
  const { from, to, setRange, lookback } = useGridDateRange()
  const { rows, loading, error, emitterId, load } = useBillingInvoices({ from, to })
  const [filter, setFilter] = useState<SriFilter>('all')

  const visible = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'pending') return rows.filter((r) => isPending(r.state))
    return rows.filter((r) => r.state === filter)
  }, [filter, rows])

  const authorized = rows.filter((r) => r.state === 'Authorized').length
  const returned = rows.filter((r) => r.state === 'Returned').length
  const rejected = rows.filter((r) => r.state === 'NotAuthorized').length
  const pending = rows.filter((r) => isPending(r.state)).length

  return (
    <TenantSessionGate
      title="Monitoreo SRI"
      lead="Entra a una empresa para ver qué contestó el SRI."
    >
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <div>
            <h1 className="app-shell__page-title">Monitoreo SRI</h1>
            <p className="app-shell__page-lead">
              Autorizadas, devueltas o pendientes. Para emitir, usa Comprobantes.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/facturacion/comprobantes')}
          >
            Ir a comprobantes
          </Button>
        </div>

        {!canRead ? (
          <p>Sin permiso para ver el monitoreo SRI.</p>
        ) : (
          <>
            <div className="ecu-companies-page__metrics" aria-label="Estados SRI">
              <article className="ecu-companies-page__metric">
                <p className="ecu-companies-page__metric-label">Autorizadas</p>
                <p className="ecu-companies-page__metric-value">{authorized}</p>
              </article>
              <article className="ecu-companies-page__metric">
                <p className="ecu-companies-page__metric-label">Devueltas</p>
                <p className="ecu-companies-page__metric-value">{returned}</p>
              </article>
              <article className="ecu-companies-page__metric">
                <p className="ecu-companies-page__metric-label">No autorizadas</p>
                <p className="ecu-companies-page__metric-value">{rejected}</p>
              </article>
              <article className="ecu-companies-page__metric">
                <p className="ecu-companies-page__metric-label">Pendientes</p>
                <p className="ecu-companies-page__metric-value">{pending}</p>
              </article>
            </div>

            {error ? <p className="ecu-companies-page__error">{error}</p> : null}

            <FacturasGrid
                rows={visible}
                loading={loading}
                emitterId={emitterId}
                canOperateInvoice={canOperate}
                onResent={() => void load({ silent: true })}
                toolbarRight={
                  <div className="ecu-comprobantes-filters">
                    <GridDateRangeBox
                      from={from}
                      to={to}
                      lookback={lookback}
                      disabled={loading}
                      onChange={setRange}
                    />
                    <ComprobantesTypeFilters
                      value={filter}
                      options={[...STATE_OPTIONS]}
                      ariaLabel="Estado SRI"
                      disabled={loading}
                      onChange={(value: string) => setFilter(value as SriFilter)}
                    />
                  </div>
                }
              />
          </>
        )}
      </div>
    </TenantSessionGate>
  )
}
