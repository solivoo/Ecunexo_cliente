import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
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

  return (
    <TenantSessionGate
      title="Comprobantes"
      lead="Entra a una empresa para ver y emitir documentos electrónicos."
    >
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <div>
            <h1 className="app-shell__page-title">Comprobantes</h1>
            <p className="app-shell__page-lead">
              Comprobantes de venta. Retenciones y liquidaciones están en Compras.
            </p>
          </div>
          <div className="ecu-page-header__actions">
            {canCreate ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => navigate('/facturacion/facturas/emitir')}
              >
                Nueva factura
              </Button>
            ) : null}
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Más tipos"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
              onActionSelect={handleActionSelect}
            />
          </div>
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de comprobantes">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">En listado</p>
            <p className="ecu-companies-page__metric-value">{visibleRows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Autorizadas</p>
            <p className="ecu-companies-page__metric-value">{authorizedCount}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Anuladas</p>
            <p className="ecu-companies-page__metric-value">{voidedCount}</p>
          </article>
        </div>

        {error ? <p className="ecu-companies-page__error">{error}</p> : null}
        {rows.length < totalCount ? (
          <p className="ecu-companies-form__hint">
            Se muestran {rows.length} de {totalCount} en el periodo. Acota el rango de fechas para ver el resto.
          </p>
        ) : null}

        {!canRead && !canCreate ? (
          <p>Sin permiso para consultar comprobantes.</p>
        ) : (
          <FacturasGrid
            rows={visibleRows}
            loading={loading}
            emitterId={emitterId}
            canOperateInvoice={canCreate}
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
          />
        )}
      </div>
    </TenantSessionGate>
  )
}
