import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast, type PageActionItem } from 'glubox'
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

  if (!canRead) {
    return (
      <TenantSessionGate title="Compras" lead="Entra a una empresa para ver compras y retenciones.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de facturación/compras para consultar los comprobantes de adquisición."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Compras"
      lead="Adquisiciones a proveedores, retenciones en la fuente y liquidaciones de compra autorizadas ante el SRI."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Compras y Retenciones"
          subtitle="No es lo que vendes. Aquí entra lo que compras a proveedores, las retenciones tributarias que emites (07) y liquidaciones de compra (03)."
          badge={
            <StatusBadge tone="primary" withDot>
              Gestión de Compras
            </StatusBadge>
          }
          actions={
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Nuevo comprobante"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
              onActionSelect={handleActionSelect}
            />
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de compras">
          <StatCard
            label="Total Comprobantes"
            value="0"
            icon="shopping_bag"
            toneColor="#4f46e5"
            footerText="En el período seleccionado"
          />
          <StatCard
            label="Retenciones Emitidas"
            value="0"
            icon="receipt_long"
            toneColor="#10b981"
            footerText="Comprobantes tipo 07"
          />
          <StatCard
            label="Liquidaciones"
            value="0"
            icon="description"
            toneColor="#0ea5e9"
            footerText="Liquidaciones tipo 03"
          />
          <StatCard
            label="Facturas de Proveedor"
            value="0"
            icon="inventory_2"
            toneColor="#8b5cf6"
            footerText="Adquisición de bienes/servicios"
          />
        </div>

        <SectionCard
          title="Comprobantes de Adquisición"
          subtitle="Documentos recibidos y emitidos ante el SRI en concepto de compras"
          action={
            <div
              className="ecu-comprobantes-filters"
              style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}
            >
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
        >
          <EmptyState
            icon="shopping_bag"
            title="Sin comprobantes de compra en este rango de fechas"
            description="Ajusta el selector de fechas superior o utiliza la opción de emisión cuando tus proveedores entreguen sus comprobantes."
          />
          <div style={{ display: 'none' }}>
            <ComprasGrid rows={[]} />
          </div>
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
