import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  GridDateRangeBox,
  GridToolbarRefresh,
  PageHeader,
  StatCard,
  SectionCard,
  EmptyState,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
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
import { formatMoney } from '@/pages/facturacion/invoiceFormTypes'
import { useBillingInvoices } from '@/pages/facturacion/useBillingInvoices'

const FACTURA_CODE = '01'
const NC_CODE = '04'

export function ComprobantesPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const canCreateInvoice = useHasPermission('facturacion.facturas.create')
  const canCreateNC =
    useHasPermission('facturacion.notas.credito.create') ||
    useHasPermission('facturacion.notascredito.create') ||
    useHasPermission('facturacion.read')
  const canCreateRemision =
    useHasPermission('facturacion.guias.remision.create') ||
    useHasPermission('facturacion.guiasremision.create') ||
    useHasPermission('facturacion.read')
  const canRead =
    useHasPermission('facturacion.comprobantes.read') ||
    useHasPermission('facturacion.facturas.read') ||
    useHasPermission('facturacion.facturas.read.all')
  const { from, to, lookback, setRange } = useGridDateRange()
  const { rows, loading, error, emitterId, load } = useBillingInvoices({ from, to })

  const typeCode = sriDocumentTypeByCode(params.get('tipo'), SALE_DOCUMENT_TYPES).code

  const visibleRows = useMemo(() => {
    if (typeCode === 'all') return rows
    return rows.filter((r) => (r.documentType ?? FACTURA_CODE) === typeCode)
  }, [rows, typeCode])

  const authorizedCount = visibleRows.filter((r) => r.state === 'Authorized' && !r.isVoided).length
  const voidedCount = visibleRows.filter((r) => r.isVoided).length
  const totalSalesUsd = useMemo(() => {
    return visibleRows
      .filter((r) => r.state === 'Authorized' && !r.isVoided)
      .reduce((acc, r) => acc + (r.grandTotal ?? 0), 0)
  }, [visibleRows])

  const actionItems = useMemo((): PageActionItem[] => {
    const items: PageActionItem[] = []

    for (const doc of SALE_DOCUMENT_TYPES) {
      if (!doc.sriCode || doc.code === FACTURA_CODE || !doc.available) continue

      let hasDocPermission = false
      if (doc.code === NC_CODE) hasDocPermission = canCreateNC
      else if (doc.code === '06') hasDocPermission = canCreateRemision

      if (hasDocPermission) {
        items.push({
          id: `nuevo-${doc.code}`,
          label: `Nueva ${doc.label.toLowerCase()}`,
          icon: 'plus',
          route: doc.emitPath,
          disabled: loading,
        })
      }
    }
    return items
  }, [canCreateNC, canCreateRemision, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
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
    [toast]
  )

  if (!canRead && !canCreateInvoice) {
    return (
      <TenantSessionGate title="Facturas" lead="Facturas de venta electrónicas.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Sin permiso para consultar facturas de venta electrónicas."
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Facturas"
      lead="Emisión y consulta de facturas electrónicas autorizadas ante el SRI."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Facturas Electrónicas"
          subtitle="Facturas de venta electrónicas autorizadas ante el SRI."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de comprobantes y ventas">
          <StatCard label="Facturado USD" value={formatMoney(totalSalesUsd)} />
          <StatCard label="Autorizadas SRI" value={authorizedCount} />
          <StatCard label="En Listado" value={visibleRows.length} />
          <StatCard label="Anuladas" value={voidedCount} />
        </div>

        <SectionCard title="Listado de Comprobantes de Venta">
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
                canCreateInvoice ? (
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
              canOperateInvoice={canCreateInvoice}
              onResent={() => void load({ silent: true })}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
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
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  {canCreateInvoice && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate('/facturacion/facturas/emitir')}
                    >
                      + Nueva Factura
                    </Button>
                  )}
                  {actionItems.length > 0 && (
                    <EcuPageActions
                      items={actionItems}
                      variant="outline"
                      triggerLabel="Más tipos SRI"
                      renderIcon={renderSidebarIcon}
                      onNavigate={(route: string) => navigate(route)}
                      onActionSelect={handleActionSelect}
                    />
                  )}
                </div>
              }
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
