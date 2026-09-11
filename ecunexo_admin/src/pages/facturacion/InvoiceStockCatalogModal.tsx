import { useEffect, useMemo, useState } from 'react'
import { Button, DataGrid, NumberBox, Popup, type ColumnDef } from 'glubox'
import { EmptyState, StatusBadge } from '@/components/ui'
import { Check, Package, Plus } from 'lucide-react'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { listCatalogItems } from '@/services/catalogApi'
import { listStock } from '@/services/inventoryApi'
import { CatalogItemKind, CatalogItemStatus, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { StockListItemDto } from '@/types/inventoryApi'

export type InvoiceStockCatalogModalProps = {
  readonly open: boolean
  readonly onClose: () => void
  readonly tenantId: string | null
  readonly targetLineId?: string | null
  readonly onSelectProduct: (
    product: CatalogItemListItemDto,
    quantity: number,
    targetLineId?: string | null
  ) => void
}

type ProductStockRow = {
  id: string
  name: string
  kind: string
  stock: number
  price: number
  qty: number
  action: string
  item: CatalogItemListItemDto
  totalStock: number | null
  isBelowMinimum: boolean
  warehouses: { readonly name: string; readonly qty: number }[]
  searchKey: string
  [key: string]: unknown
}

const messages = createSpanishDataGridMessages('producto', 'productos')

export function InvoiceStockCatalogModal({
  open,
  onClose,
  tenantId,
  targetLineId,
  onSelectProduct,
}: InvoiceStockCatalogModalProps) {
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])
  const [stockItems, setStockItems] = useState<StockListItemDto[]>([])
  const [loading, setLoading] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'physical' | 'service' | 'with_stock'>('all')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging(6)

  useEffect(() => {
    if (!open || !tenantId) return

    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const [items, stocks] = await Promise.all([
          listCatalogItems(tenantId).catch(() => []),
          listStock(tenantId).catch(() => []),
        ])
        if (!cancelled) {
          setCatalogItems(items.filter((i) => i.status === CatalogItemStatus.Active))
          setStockItems(stocks)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, tenantId])

  const productsWithStock = useMemo<ProductStockRow[]>(() => {
    const stockByItem = new Map<string, StockListItemDto[]>()
    for (const s of stockItems) {
      const list = stockByItem.get(s.catalogItemId) ?? []
      list.push(s)
      stockByItem.set(s.catalogItemId, list)
    }

    return catalogItems.map((item) => {
      if (item.kind === CatalogItemKind.Service) {
        return {
          id: item.id,
          name: item.name,
          kind: 'service',
          stock: 0,
          price: item.basePrice ?? 0,
          qty: 1,
          action: '',
          item,
          totalStock: null,
          isBelowMinimum: false,
          warehouses: [],
          searchKey: `${item.sku ?? ''} ${item.name} ${item.categoryName ?? ''}`.toLowerCase(),
        }
      }

      const matching = stockByItem.get(item.id) ?? []
      const totalStock = matching.reduce((acc, curr) => acc + curr.quantity, 0)
      const isBelowMinimum = matching.some((m) => m.isBelowMinimum)
      const warehouses = matching.map((m) => ({
        name: m.warehouseName,
        qty: m.quantity,
      }))

      return {
        id: item.id,
        name: item.name,
        kind: 'physical',
        stock: totalStock,
        price: item.basePrice ?? 0,
        qty: 1,
        action: '',
        item,
        totalStock,
        isBelowMinimum,
        warehouses,
        searchKey: `${item.sku ?? ''} ${item.name} ${item.categoryName ?? ''}`.toLowerCase(),
      }
    })
  }, [catalogItems, stockItems])

  const filteredProducts = useMemo(() => {
    return productsWithStock.filter((p) => {
      if (filterMode === 'physical' && p.item.kind !== CatalogItemKind.Physical) return false
      if (filterMode === 'service' && p.item.kind !== CatalogItemKind.Service) return false
      if (filterMode === 'with_stock') {
        if (p.item.kind === CatalogItemKind.Service) return true
        if ((p.totalStock ?? 0) <= 0) return false
      }
      return true
    })
  }, [productsWithStock, filterMode])

  const handleAdd = (row: ProductStockRow) => {
    const qty = quantities[row.item.id] ?? 1
    onSelectProduct(row.item, qty, targetLineId)
    setRecentlyAddedId(row.item.id)
    setTimeout(() => {
      setRecentlyAddedId(null)
    }, 1500)
    if (targetLineId) {
      onClose()
    }
  }

  const handleQuantityChange = (itemId: string, val: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(1, val),
    }))
  }

  const columns = useMemo(
    (): ColumnDef<ProductStockRow>[] => [
      {
        key: 'name',
        header: 'Ítem / Producto',
        sortable: true,
        renderCell: (_v: unknown, row: ProductStockRow) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {row.item.sku && (
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: 'var(--shell-primary)',
                }}
              >
                {row.item.sku}
              </span>
            )}
            <strong style={{ color: 'var(--glb-text)', fontSize: '0.875rem' }}>
              {row.item.name}
            </strong>
            {row.item.categoryName && (
              <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                {row.item.categoryName}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'kind',
        header: 'Tipo',
        width: 100,
        align: 'center',
        renderCell: (_v: unknown, row: ProductStockRow) => (
          <StatusBadge tone={row.item.kind === CatalogItemKind.Service ? 'neutral' : 'primary'}>
            {row.item.kind === CatalogItemKind.Service ? 'Servicio' : 'Físico'}
          </StatusBadge>
        ),
      },
      {
        key: 'stock',
        header: 'Stock Disponible',
        width: 180,
        renderCell: (_v: unknown, row: ProductStockRow) => {
          if (row.item.kind === CatalogItemKind.Service) {
            return (
              <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
                Ilimitado (Servicio)
              </span>
            )
          }
          const stock = row.totalStock ?? 0
          if (stock <= 0) {
            return (
              <StatusBadge tone="danger" withDot>
                Sin stock (0)
              </StatusBadge>
            )
          }
          if (row.isBelowMinimum) {
            return (
              <div
                title={row.warehouses
                  .map((w: { readonly name: string; readonly qty: number }) => `${w.name}: ${w.qty}`)
                  .join(' · ')}
              >
                <StatusBadge tone="warning" withDot>
                  {stock} unid. (Bajo mín.)
                </StatusBadge>
              </div>
            )
          }
          return (
            <div
              title={row.warehouses
                .map((w: { readonly name: string; readonly qty: number }) => `${w.name}: ${w.qty}`)
                .join(' · ')}
            >
              <StatusBadge tone="success" withDot>
                {stock} unid.
              </StatusBadge>
              {row.warehouses.length > 1 && (
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    color: 'var(--glb-muted)',
                  }}
                >
                  {row.warehouses.length} bodegas
                </span>
              )}
            </div>
          )
        },
      },
      {
        key: 'price',
        header: 'PVP / Base',
        width: 110,
        align: 'right',
        renderCell: (_v: unknown, row: ProductStockRow) => (
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: 'var(--glb-text)',
            }}
          >
            ${(row.item.basePrice ?? 0).toFixed(2)}
          </span>
        ),
      },
      {
        key: 'qty',
        header: 'Cant.',
        width: 90,
        align: 'center',
        renderCell: (_v: unknown, row: ProductStockRow) => (
          <div style={{ width: '64px', margin: '0 auto' }}>
            <NumberBox
              size="sm"
              min={1}
              step={1}
              value={quantities[row.item.id] ?? 1}
              onChange={(e) => handleQuantityChange(row.item.id, Number(e.target.value) || 1)}
              fullWidth
            />
          </div>
        ),
      },
      {
        key: 'action',
        header: 'Acción',
        width: 110,
        align: 'right',
        renderCell: (_v: unknown, row: ProductStockRow) => {
          const isRecent = recentlyAddedId === row.item.id
          return (
            <Button
              type="button"
              variant={isRecent ? 'outline' : 'primary'}
              size="sm"
              onClick={() => handleAdd(row)}
            >
              {isRecent ? (
                <>
                  <Check size={14} strokeWidth={2.5} aria-hidden /> Agregado
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={2} aria-hidden />
                  {targetLineId ? 'Elegir' : 'Agregar'}
                </>
              )}
            </Button>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quantities, recentlyAddedId, targetLineId]
  )

  const toolbarRight = (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <Button
        type="button"
        variant={filterMode === 'all' ? 'primary' : 'outline'}
        size="sm"
        onClick={() => setFilterMode('all')}
      >
        Todos
      </Button>
      <Button
        type="button"
        variant={filterMode === 'with_stock' ? 'primary' : 'outline'}
        size="sm"
        onClick={() => setFilterMode('with_stock')}
      >
        Con stock disponible
      </Button>
      <Button
        type="button"
        variant={filterMode === 'physical' ? 'primary' : 'outline'}
        size="sm"
        onClick={() => setFilterMode('physical')}
      >
        Físicos
      </Button>
      <Button
        type="button"
        variant={filterMode === 'service' ? 'primary' : 'outline'}
        size="sm"
        onClick={() => setFilterMode('service')}
      >
        Servicios
      </Button>
    </div>
  )

  return (
    <Popup
      open={open}
      title="Catálogo de Productos y Disponibilidad de Stock"
      onClose={onClose}
      width="min(96vw, 58rem)"
      actions={[
        {
          id: 'close',
          label: 'Cerrar',
          variant: 'outline',
          onClick: onClose,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p className="ecu-modal-section-lead" style={{ margin: 0 }}>
          {targetLineId
            ? 'Selecciona un ítem para asignarlo a la línea del comprobante.'
            : 'Consulta existencias por bodega y agrega uno o varios productos a la factura electrónica.'}
        </p>

        {loading ? (
          <p className="ecu-modal-section-lead" style={{ textAlign: 'center', padding: '3rem 0' }}>
            Cargando catálogo y saldos de stock…
          </p>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            className="ecu-empty-state--compact"
            icon={<Package size={24} strokeWidth={1.75} aria-hidden />}
            title="No se encontraron productos"
            description="No hay ítems que coincidan con los filtros actuales."
          />
        ) : (
          <DataGrid<ProductStockRow>
            className="ecu-companies-grid"
            dataSource={filteredProducts}
            keyExpr="id"
            columns={columns}
            selectionMode="none"
            showSearch
            searchPosition="left"
            searchWidth={260}
            searchPlaceholder="Buscar SKU o nombre…"
            searchKeys={['searchKey']}
            toolbarRight={toolbarRight}
            paging={paging}
            paginationMode="client"
            pageSizeOptions={pageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            messages={messages}
            fullWidth
          />
        )}
      </div>
    </Popup>
  )
}
