import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'glubox'
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
} from '@/components/ui'
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

  if (!canRead) {
    return (
      <TenantSessionGate title="Monitoreo SRI" lead="Monitoreo tributario de comprobantes.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres facturacion.sri.read para monitorear las respuestas del SRI."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Monitoreo SRI"
      lead="Supervisión en tiempo real de las respuestas emitidas por los servicios del SRI."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Monitoreo SRI"
          subtitle="Supervisión de estados de autorización, devolución y procesamiento ante los Web Services del SRI. Para emitir, ingresa a Comprobantes."
          badge={
            <StatusBadge
              tone={returned > 0 || rejected > 0 ? 'warning' : 'success'}
              withDot
            >
              {authorized} Autorizadas
            </StatusBadge>
          }
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/facturacion/comprobantes')}
            >
              Ir a Comprobantes
            </Button>
          }
        />

        <div className="ecu-stat-grid" aria-label="Estados SRI">
          <StatCard
            label="Autorizadas por SRI"
            value={authorized}
            icon="verified"
            toneColor="#10b981"
            footerText="Aprobadas con validez fiscal"
          />
          <StatCard
            label="Devueltas (Revisión)"
            value={returned}
            icon="replay"
            toneColor={returned > 0 ? '#f59e0b' : '#10b981'}
            footerText={returned > 0 ? 'Requieren corrección y reenvío' : 'Sin devoluciones'}
          />
          <StatCard
            label="No Autorizadas"
            value={rejected}
            icon="error"
            toneColor={rejected > 0 ? '#ef4444' : '#6b7280'}
            footerText={rejected > 0 ? 'Rechazadas formalmente' : 'Sin rechazos'}
          />
          <StatCard
            label="Pendientes en Cola"
            value={pending}
            icon="pending"
            toneColor="#0ea5e9"
            footerText="En proceso de transmisión"
          />
        </div>

        <SectionCard
          title="Cola de Transmisión Tributaria"
          subtitle="Monitoreo del ciclo de firma electrónica, envío y validación de comprobantes"
          action={
            <div
              className="ecu-comprobantes-filters"
              style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}
            >
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
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {visible.length === 0 && !loading ? (
            <EmptyState
              icon="verified"
              title="Sin comprobantes en el filtro seleccionado"
              description="No se registran documentos con este estado en el rango de fechas indicado."
            />
          ) : (
            <FacturasGrid
              rows={visible}
              loading={loading}
              emitterId={emitterId}
              canOperateInvoice={canOperate}
              onResent={() => void load({ silent: true })}
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
