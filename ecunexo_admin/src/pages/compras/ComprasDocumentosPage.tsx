import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import {
  Eye,
  PackageCheck,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { listCatalogItems } from '@/services/catalogApi'
import { listWarehouses } from '@/services/inventoryApi'
import { listExpenseTypes, listPurchases } from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { ParseXmlModal } from '@/pages/compras/ParseXmlModal'
import { PurchaseDetailModal } from '@/pages/compras/PurchaseDetailModal'
import { ReceivePurchaseModal } from '@/pages/compras/ReceivePurchaseModal'
import type { CatalogItemListItemDto } from '@/types/catalogApi'
import type { WarehouseListItemDto } from '@/types/inventoryApi'
import type {
  ExpenseTypeDto,
  ListPurchasesKpisDto,
  PurchaseFilterParams,
  PurchaseStatus,
  PurchaseSummaryDto,
} from '@/types/purchasesApi'
import '@/pages/repairs/ecu-customer-form.css'

type PurchaseRow = PurchaseSummaryDto & Record<string, unknown> & { actions?: unknown }

function formatStatus(status: PurchaseStatus): {
  label: string
  tone: 'neutral' | 'primary' | 'success' | 'danger' | 'warning'
} {
  switch (status) {
    case 1:
      return { label: 'Borrador', tone: 'neutral' }
    case 2:
      return { label: 'Mercadería Recibida', tone: 'success' }
    case 3:
      return { label: 'Facturado', tone: 'primary' }
    case 4:
      return { label: 'Cancelado', tone: 'danger' }
    default:
      return { label: 'Borrador', tone: 'neutral' }
  }
}

const gridMessages = createSpanishDataGridMessages('factura de compra', 'facturas de compra')

export function ComprasDocumentosPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('purchases.documents.read') ||
    useHasPermission('purchases.documents.manage') ||
    useHasPermission('purchases.read')
  const canManage =
    useHasPermission('purchases.documents.manage') ||
    useHasPermission('purchases.manage')

  // Data states
  const [loading, setLoading] = useState(true)
  const [purchases, setPurchases] = useState<PurchaseSummaryDto[]>([])
  const [kpis, setKpis] = useState<ListPurchasesKpisDto>({
    totalPurchases: 0,
    totalReceived: 0,
    totalDraft: 0,
    totalBilledAmount: 0,
  })

  // Supporting catalogs
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeDto[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modals
  const [xmlModalOpen, setXmlModalOpen] = useState(false)
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [selectedPurchaseForReceive, setSelectedPurchaseForReceive] =
    useState<PurchaseSummaryDto | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedPurchaseIdForDetail, setSelectedPurchaseIdForDetail] = useState<string | null>(
    null
  )

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const filterParams: PurchaseFilterParams = {}
      if (search.trim()) filterParams.search = search.trim()
      if (statusFilter !== 'all') {
        filterParams.status = Number(statusFilter) as PurchaseStatus
      }

      const [purchasesRes, expenseTypesData, warehousesData, catalogData] = await Promise.all([
        listPurchases(tenantId, filterParams),
        listExpenseTypes(tenantId, true),
        listWarehouses(tenantId),
        listCatalogItems(tenantId),
      ])

      setPurchases(purchasesRes.purchases)
      setKpis(purchasesRes.kpis)
      setExpenseTypes(expenseTypesData)
      setWarehouses(warehousesData)
      setCatalogItems(catalogData)
    } catch (err) {
      toast.show({
        title: 'Error de carga',
        message: readApiError(err, 'No se pudieron cargar los documentos de compra.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, search, statusFilter, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleXmlSuccess = useCallback(
    (_purchaseId: string, invoiceNumber: string) => {
      setXmlModalOpen(false)
      toast.show({
        title: 'Factura registrada',
        message: `Factura N° ${invoiceNumber} registrada con éxito en compras.`,
        variant: 'success',
      })
      void loadData()
    },
    [loadData, toast]
  )

  const handleReceiveSuccess = useCallback(
    (_purchaseId: string) => {
      setReceiveModalOpen(false)
      setSelectedPurchaseForReceive(null)
      toast.show({
        title: 'Mercadería ingresada a inventario',
        message: 'Recepción de stock procesada y kárdex actualizado correctamente.',
        variant: 'success',
      })
      void loadData()
    },
    [loadData, toast]
  )

  const handleOpenReceive = useCallback((purchase: PurchaseSummaryDto) => {
    setSelectedPurchaseForReceive(purchase)
    setReceiveModalOpen(true)
  }, [])

  const handleOpenDetail = useCallback((purchaseId: string) => {
    setSelectedPurchaseIdForDetail(purchaseId)
    setDetailModalOpen(true)
  }, [])

  const columns = useMemo((): ColumnDef<PurchaseRow>[] => {
    return [
      {
        key: 'invoiceNumber',
        header: 'N° Factura',
        width: 170,
        sortable: true,
        renderCell: (_v: unknown, row: PurchaseRow) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{row.invoiceNumber}</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--glb-muted, #64748b)' }}>
              {row.documentType === '01' ? 'Factura Electrónica' : `Doc. ${row.documentType}`}
            </span>
          </div>
        ),
      },
      {
        key: 'supplierBusinessName',
        header: 'Proveedor',
        width: 250,
        sortable: true,
        renderCell: (_v: unknown, row: PurchaseRow) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600 }}>{row.supplierBusinessName}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
              RUC: {row.supplierTaxId}
            </span>
          </div>
        ),
      },
      {
        key: 'issueDate',
        header: 'Fecha Emisión',
        width: 120,
        sortable: true,
      },
      {
        key: 'itemsCount',
        header: 'Tipo / Ítems',
        width: 140,
        renderCell: (_v: unknown, row: PurchaseRow) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {row.affectsInventory === false ? (
              <span className="ecu-tag ecu-tag--service" style={{ margin: 0, width: 'fit-content' }}>
                💼 Servicio
              </span>
            ) : (
              <span className="ecu-tag ecu-tag--goods" style={{ margin: 0, width: 'fit-content' }}>
                📦 Bienes ({row.itemsCount})
              </span>
            )}
            {row.expenseTypeName ? (
              <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted)' }}>
                {row.expenseTypeName}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'subtotalTaxed',
        header: 'Subt. Gravado',
        width: 120,
        align: 'right',
        renderCell: (_v: unknown, row: PurchaseRow) => (
          <span>${row.subtotalTaxed.toFixed(2)}</span>
        ),
      },
      {
        key: 'taxAmount',
        header: 'IVA',
        width: 95,
        align: 'right',
        renderCell: (_v: unknown, row: PurchaseRow) => (
          <span>${row.taxAmount.toFixed(2)}</span>
        ),
      },
      {
        key: 'totalAmount',
        header: 'Total Factura',
        width: 130,
        align: 'right',
        sortable: true,
        renderCell: (_v: unknown, row: PurchaseRow) => (
          <strong style={{ color: 'var(--shell-primary, #4f46e5)' }}>
            ${row.totalAmount.toFixed(2)}
          </strong>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 160,
        sortable: true,
        renderCell: (_v: unknown, row: PurchaseRow) => {
          const s = formatStatus(row.status)
          return <StatusBadge tone={s.tone} withDot>{s.label}</StatusBadge>
        },
      },
      {
        key: 'id',
        header: 'Acciones',
        width: 110,
        sortable: false,
        align: 'center',
        renderCell: (_v: unknown, row: PurchaseRow) => (
          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
            <GridIconButton
              label="Ver detalle de factura"
              icon={Eye}
              onClick={() => handleOpenDetail(row.id)}
            />
            {row.status === 1 && row.affectsInventory !== false && canManage && (
              <GridIconButton
                label="Recepcionar en bodega"
                icon={PackageCheck}
                onClick={() => handleOpenReceive(row)}
              />
            )}
          </div>
        ),
      },
    ]
  }, [canManage, handleOpenDetail, handleOpenReceive])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos los estados' },
      { value: '1', label: 'Borrador' },
      { value: '2', label: 'Mercadería Recibida' },
      { value: '3', label: 'Facturado' },
      { value: '4', label: 'Cancelado' },
    ],
    []
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Compras" lead="Entra a una empresa para ver compras e inventario.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de compras o facturación para consultar las facturas de proveedores."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Compras"
      lead="Gestión de adquisiciones a proveedores, parseo automático de XML del SRI e ingreso a inventario."
    >
      <div className="ecu-dashboard-layout">
        {/* PageHeader adhering strictly to Rule 3 (no duplicate buttons in actions) */}
        <PageHeader
          title="Documentos y Facturas de Compra"
          subtitle="Adquisiciones de bienes y servicios, parseo automático de comprobantes electrónicos SRI e ingreso directo a bodega."
          badge={
            <StatusBadge tone="primary" withDot>
              Módulo Compras
            </StatusBadge>
          }
          actions={
            canManage ? (
              <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                <Button
                  variant="outline"
                  onClick={() => void loadData()}
                  disabled={loading}
                >
                  <RefreshCw size={15} className={loading ? 'ecu-spin' : ''} />
                  Actualizar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => navigate('/compras/documentos/importar')}
                >
                  <UploadCloud size={16} />
                  Importar Facturas SRI (Lote / XML)
                </Button>
              </div>
            ) : undefined
          }
        />

        {/* KPI Strip */}
        <div className="ecu-stat-grid" aria-label="Resumen de facturas de compra">
          <StatCard
            label="Total Facturas"
            value={String(kpis.totalPurchases)}
            icon="shopping_bag"
            toneColor="#4f46e5"
            footerText="Registradas en el sistema"
          />
          <StatCard
            label="Mercadería Recibida"
            value={String(kpis.totalReceived)}
            icon="inventory_2"
            toneColor="#10b981"
            footerText="Con ingreso físico a bodega"
          />
          <StatCard
            label="En Borrador"
            value={String(kpis.totalDraft)}
            icon="description"
            toneColor="#f59e0b"
            footerText="Pendientes de recepcionar"
          />
          <StatCard
            label="Total Facturado"
            value={`$${kpis.totalBilledAmount.toFixed(2)}`}
            icon="receipt_long"
            toneColor="#8b5cf6"
            footerText="Monto consolidado compras"
          />
        </div>

        {/* Section Container with DataGrid */}
        <SectionCard
          title="Facturas de Proveedores"
          subtitle="Listado general de compras recibidas y autorizadas ante el SRI"
          action={
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ width: '220px' }}>
                <TextBox
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proveedor o factura..."
                  variant="outline"
                  size="sm"
                  fullWidth
                />
              </div>

              <div style={{ width: '200px' }}>
                <Select
                  value={statusFilter}
                  options={statusOptions}
                  onChange={(val: string) => setStatusFilter(val)}
                  variant="outline"
                  size="sm"
                  fullWidth
                />
              </div>
            </div>
          }
        >
          {purchases.length === 0 && !loading ? (
            <EmptyState
              icon="shopping_bag"
              title="No hay facturas de compra registradas"
              description="Sube un archivo XML de factura electrónica emitida por tu proveedor para parsear ítems e ingresar a bodega."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate('/compras/documentos/importar')}
                  >
                    <UploadCloud size={16} />
                    Importar Facturas SRI (Lote / XML)
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={purchases as PurchaseRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch={false}
              paging={paging}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              pageSizeOptions={pageSizeOptions}
              layout="auto"
              cardBreakpoint={768}
              virtualized
              virtualThreshold={40}
              showRowCount
              fullWidth
              loading={loading}
              messages={gridMessages}
              stickyFirstColumn
            />
          )}
        </SectionCard>
      </div>

      {/* XML Parse Modal */}
      {tenantId && (
        <ParseXmlModal
          open={xmlModalOpen}
          tenantId={tenantId}
          expenseTypes={expenseTypes}
          warehouses={warehouses}
          catalogItems={catalogItems}
          onClose={() => setXmlModalOpen(false)}
          onSuccess={handleXmlSuccess}
        />
      )}

      {/* Receive Purchase Modal */}
      {tenantId && (
        <ReceivePurchaseModal
          open={receiveModalOpen}
          tenantId={tenantId}
          purchase={selectedPurchaseForReceive}
          warehouses={warehouses}
          onClose={() => {
            setReceiveModalOpen(false)
            setSelectedPurchaseForReceive(null)
          }}
          onSuccess={handleReceiveSuccess}
        />
      )}

      {/* Purchase Detail Modal */}
      {tenantId && (
        <PurchaseDetailModal
          open={detailModalOpen}
          tenantId={tenantId}
          purchaseId={selectedPurchaseIdForDetail}
          onClose={() => {
            setDetailModalOpen(false)
            setSelectedPurchaseIdForDetail(null)
          }}
          onReceiveClick={() => {
            const found = purchases.find((p) => p.id === selectedPurchaseIdForDetail)
            if (found) {
              handleOpenReceive(found)
            }
          }}
        />
      )}
    </TenantSessionGate>
  )
}
