import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import {
  Eye,
  PackageCheck,
  UploadCloud,
} from 'lucide-react'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  GridToolbarRefresh,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
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
  variant: 'active' | 'warning' | 'danger'
} {
  switch (status) {
    case 1:
      return { label: 'Borrador', variant: 'warning' }
    case 2:
      return { label: 'Mercadería Recibida', variant: 'active' }
    case 3:
      return { label: 'Facturado', variant: 'active' }
    case 4:
      return { label: 'Cancelado', variant: 'danger' }
    default:
      return { label: 'Borrador', variant: 'warning' }
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
      setCatalogItems(catalogData.filter((c) => !c.isMatrixParent))
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
            <code className="ecu-code">{row.invoiceNumber}</code>
            <span className="ecu-source">
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
            <span className="ecu-clip ecu-clip--wide" style={{ fontWeight: 600 }}>
              {row.supplierBusinessName}
            </span>
            <span className="ecu-source">RUC: {row.supplierTaxId}</span>
          </div>
        ),
      },
      {
        key: 'issueDate',
        header: 'Fecha Emisión',
        width: 110,
        sortable: true,
        renderCell: (_v: unknown, row: PurchaseRow) => formatDate(row.issueDate),
      },
      {
        key: 'itemsCount',
        header: 'Tipo / Ítems',
        width: 140,
        renderCell: (_v: unknown, row: PurchaseRow) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span className="ecu-chip">
              {row.affectsInventory === false ? 'Servicio' : `Bienes (${row.itemsCount})`}
            </span>
            {row.expenseTypeName ? (
              <span className="ecu-source ecu-clip">{row.expenseTypeName}</span>
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
          return (
            <span className={`ecu-status ecu-status--${s.variant}`}>
              <span className="ecu-status__dot" aria-hidden />
              {s.label}
            </span>
          )
        },
      },
      {
        key: 'id',
        header: 'Acciones',
        width: 110,
        sortable: false,
        align: 'center',
        sticky: 'right',
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
        <div className="ecu-dashboard-layout ecu-section-page">
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
      <div className="ecu-dashboard-layout ecu-section-page">
        {/* PageHeader adhering strictly to Rule 3 (no duplicate buttons in actions) */}
        <PageHeader
          title="Documentos y Facturas de Compra"
          subtitle="Facturas de proveedores, parsing XML SRI e ingreso a bodega."
          badge={<StatusBadge tone="neutral">Módulo Compras</StatusBadge>}
        />

        {/* KPI Strip */}
        <div className="ecu-stat-grid" aria-label="Resumen de facturas de compra">
          <StatCard label="Total Facturas" value={kpis.totalPurchases} />
          <StatCard label="Mercadería Recibida" value={kpis.totalReceived} />
          <StatCard label="En Borrador" value={kpis.totalDraft} />
          <StatCard label="Total Facturado ($)" value={kpis.totalBilledAmount} />
        </div>

        {/* Section Container with DataGrid */}
        <SectionCard title="Facturas de Proveedores">
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
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
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
                  <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                  {canManage && (
                    <Button
                      variant="primary"
                      onClick={() => navigate('/compras/documentos/importar')}
                    >
                      <UploadCloud size={16} />
                      Importar Facturas SRI (Lote / XML)
                    </Button>
                  )}
                </div>
              }
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
