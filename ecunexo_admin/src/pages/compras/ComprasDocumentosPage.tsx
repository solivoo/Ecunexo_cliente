import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { ComprasGrid } from '@/pages/compras/ComprasGrid'
import { ComprobantesTypeFilters } from '@/pages/facturacion/ComprobantesTypeFilters'
import {
  PURCHASE_DOCUMENT_TYPES,
  sriDocumentTypeByCode,
  sriTypeFilterOptions,
} from '@/pages/facturacion/sriDocumentTypes'

function tipoFromPath(pathname: string, queryTipo: string | null): string {
  if (pathname.includes('/compras/retenciones')) return '07'
  if (pathname.includes('/compras/liquidaciones')) return '03'
  return queryTipo ?? 'all'
}

export function ComprasDocumentosPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const canRead = useHasPermission('facturacion.read')
  const { from, to, setRange, lookback } = useGridDateRange()
  const typeCode = sriDocumentTypeByCode(
    tipoFromPath(location.pathname, params.get('tipo')),
    PURCHASE_DOCUMENT_TYPES
  ).code

  const actionItems = useMemo((): PageActionItem[] => {
    return PURCHASE_DOCUMENT_TYPES.filter((d) => d.code !== 'all').map((doc) => ({
      id: `nuevo-${doc.code}`,
      label: `${doc.label} · pronto`,
      icon: 'plus',
      route: null,
      disabled: false,
    }))
  }, [])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      toast.show({
        title: 'Próximamente',
        message:
          item.id === 'nuevo-prov'
            ? 'Registrarás la factura que te envió el proveedor (XML / RIDE).'
            : 'Lo emitirás tú al SRI desde esta pantalla de Compras.',
        variant: 'info',
      })
    },
    [toast]
  )

  const onTypeChange = useCallback(
    (next: string) => {
      if (next === '07') {
        void navigate('/compras/retenciones', { replace: true })
        return
      }
      if (next === '03') {
        void navigate('/compras/liquidaciones', { replace: true })
        return
      }
      const copy = new URLSearchParams(params)
      if (next === 'all') copy.delete('tipo')
      else copy.set('tipo', next)
      void navigate({ pathname: '/compras/documentos', search: copy.toString() }, { replace: true })
    },
    [navigate, params]
  )

  return (
    <TenantSessionGate
      title="Compras"
      lead="Entra a una empresa para ver compras y retenciones."
    >
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <div>
            <h1 className="app-shell__page-title">Compras</h1>
            <p className="app-shell__page-lead">
              No es lo que vendes. Aquí entra lo que compras y lo que retienes al proveedor.
            </p>
          </div>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Nuevo"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={handleActionSelect}
          />
        </div>

        {!canRead ? (
          <p>Sin permiso para ver compras.</p>
        ) : (
          <ComprasGrid
              rows={[]}
              toolbarRight={
                <div className="ecu-comprobantes-filters">
                  <GridDateRangeBox
                    from={from}
                    to={to}
                    lookback={lookback}
                    onChange={setRange}
                  />
                  <ComprobantesTypeFilters
                    value={typeCode}
                    options={sriTypeFilterOptions(PURCHASE_DOCUMENT_TYPES)}
                    ariaLabel="Tipo de documento de compra"
                    onChange={onTypeChange}
                  />
                </div>
              }
            />
        )}
      </div>
    </TenantSessionGate>
  )
}
