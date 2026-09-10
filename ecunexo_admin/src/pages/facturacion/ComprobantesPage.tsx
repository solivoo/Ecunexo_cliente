import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { FacturasGrid } from '@/pages/facturacion/FacturasGrid'
import { ComprobantesTypeFilters } from '@/pages/facturacion/ComprobantesTypeFilters'
import {
  SALE_DOCUMENT_TYPES,
  sriDocumentTypeByCode,
  sriTypeFilterOptions,
} from '@/pages/facturacion/sriDocumentTypes'
import { useBillingInvoices } from '@/pages/facturacion/useBillingInvoices'

const FACTURA_CODE = '01'
const NC_CODE = '04'

export function ComprobantesPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const canCreate = useHasPermission('facturacion.facturas.create')
  const canRead =
    useHasPermission('facturacion.comprobantes.read') ||
    useHasPermission('facturacion.facturas.read') ||
    useHasPermission('facturacion.facturas.read.all')
  const { from, to, setRange, lookback } = useGridDateRange()
  const { rows, loading, error, totalCount, emitterId, load } = useBillingInvoices({ from, to })

  const typeCode = sriDocumentTypeByCode(params.get('tipo'), SALE_DOCUMENT_TYPES).code

  const visibleRows = useMemo(() => {
    if (typeCode === 'all') return rows
    return rows.filter((r) => (r.documentType ?? FACTURA_CODE) === typeCode)
  }, [rows, typeCode])

  const authorizedCount = visibleRows.filter((r) => r.state === 'Authorized' && !r.isVoided).length
  const voidedCount = visibleRows.filter((r) => r.isVoided).length

  const actionItems = useMemo((): PageActionItem[] => {
    const items: PageActionItem[] = [
      {
        id: 'refresh',
        label: 'Actualizar',
        icon: 'refresh-cw',
        route: null,
        disabled: loading,
      },
    ]
    for (const doc of SALE_DOCUMENT_TYPES) {
      if (!doc.sriCode) continue
      items.push({
        id: `nuevo-${doc.code}`,
        label: doc.available ? `Nueva ${doc.label.toLowerCase()}` : `${doc.label} · pronto`,
        icon: 'plus',
        route: doc.available && canCreate ? doc.emitPath : null,
        disabled: loading || (doc.available && !canCreate),
      })
    }
    return items
  }, [canCreate, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
        return
      }
      if (item.id === `nuevo-${NC_CODE}`) {
        toast.show({
          title: 'Nota de crédito',
          message: 'Anule una factura autorizada desde el listado (icono de anular).',
          variant: 'info',
        })
        return
      }
      if (item.route || item.disabled) return
      toast.show({
        title: 'Próximamente',
        message: 'Se emitirá desde esta misma pantalla, eligiendo el tipo SRI.',
        variant: 'info',
      })
    },
    [load, toast]
  )

  if (!canRead && !canCreate) {
    return (
      <TenantSessionGate title="Comprobantes" lead="Comprobantes de venta electrónicos.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Sin permiso para consultar comprobantes de venta electrónicos."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Comprobantes"
      lead="Emisión y consulta de comprobantes electrónicos autorizados ante el SRI."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Comprobantes Electrónicos"
          subtitle="Comprobantes de venta autorizados ante el SRI. Para retenciones en compras y liquidaciones, consulta el módulo de Compras."
          badge={
            <StatusBadge tone="primary" withDot>
              {visibleRows.length} {visibleRows.length === 1 ? 'Comprobante' : 'Comprobantes'}
            </StatusBadge>
          }
          actions={
            <>
              {canCreate && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/facturacion/facturas/emitir')}
                >
                  + Nueva Factura
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Más tipos SRI"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de comprobantes">
          <StatCard
            label="En Listado"
            value={visibleRows.length}
            icon="receipt"
            toneColor="#4f46e5"
            footerText="Comprobantes filtrados"
          />
          <StatCard
            label="Autorizadas por SRI"
            value={authorizedCount}
            icon="verified"
            toneColor="#10b981"
            footerText="Con validez fiscal"
          />
          <StatCard
            label="Anuladas"
            value={voidedCount}
            icon="cancel"
            toneColor={voidedCount > 0 ? '#ef4444' : '#6b7280'}
            footerText="Comprobantes invalidados"
          />
          <StatCard
            label="Total en Período"
            value={totalCount}
            icon="calendar_month"
            toneColor="#8b5cf6"
            footerText="Registros de facturación"
          />
        </div>

        <SectionCard
          title="Listado de Comprobantes de Venta"
          subtitle="Facturas, notas de crédito y débito emitidas en el rango de fechas seleccionado"
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
                value={typeCode}
                options={sriTypeFilterOptions(SALE_DOCUMENT_TYPES)}
                ariaLabel="Tipo de comprobante de venta"
                disabled={loading}
                onChange={(next) => {
                  const copy = new URLSearchParams(params)
                  if (next === 'all') copy.delete('tipo')
                  else copy.set('tipo', next)
                  setParams(copy, { replace: true })
                }}
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

          {visibleRows.length === 0 && !loading ? (
            <EmptyState
              icon="receipt"
              title="Sin comprobantes de venta en este período"
              description="No se registran comprobantes emitidos con los filtros actuales. Ajusta el rango de fechas o emite una nueva factura electrónica."
              action={
                canCreate ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/facturacion/facturas/emitir')}
                  >
                    + Nueva Factura
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <FacturasGrid
              rows={visibleRows}
              loading={loading}
              emitterId={emitterId}
              canOperateInvoice={canCreate}
              onResent={() => void load({ silent: true })}
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
