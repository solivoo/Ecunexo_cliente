import { useEffect, useMemo, useState } from 'react'
import { Button, DataGrid, NumberBox, Popup, type ColumnDef } from 'glubox'
import { EmptyState, StatusBadge } from '@/components/ui'
import { Package, X } from 'lucide-react'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { flattenAttributeEntries } from '@/lib/catalogAttributes'
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

type AttributeChip = {
  label: string
  value: string
}

type ProductStockRow = {
  id: string
  name: string
  kind: string
  select?: boolean
  stock: number
  price: number
  qty: number
  item: CatalogItemListItemDto
  totalStock: number | null
  isBelowMinimum: boolean
  warehouses: { readonly name: string; readonly qty: number }[]
  attributes: AttributeChip[]
  searchKey: string
  [key: string]: unknown
}

const messages = createSpanishDataGridMessages('producto', 'productos')

function parseDescriptionAttributes(description: string | null | undefined): AttributeChip[] {
  if (!description?.trim()) return []

  const chips: AttributeChip[] = []
  // Si la descripción contiene pares tipo "Talla: L; Color: Negro; Marca: Nike" o líneas separadas
  const parts = description.split(/[;\n]/)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
      const label = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()
      if (label && value && label.length < 25 && value.length < 40) {
        chips.push({ label, value })
        continue
      }
    }

    // Si es un atributo simple corto (ej. "Talla XL" o "Algodón 100%")
    if (trimmed.length < 30) {
      chips.push({ label: '', value: trimmed })
    }
  }

  return chips
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging(6)

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set())
      setQuantities({})
      return
    }

    if (!tenantId) return

    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const [items, stocks] = await Promise.all([
          listCatalogItems(tenantId).catch(() => []),
          listStock(tenantId).catch(() => []),
        ])
        if (!cancelled) {
          setCatalogItems(
            items.filter((i) => i.status === CatalogItemStatus.Active && !i.isMatrixParent)
          )
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
      const customAttrEntries = flattenAttributeEntries(item.customAttributesJson)
      const descAttrChips = parseDescriptionAttributes(item.description)

      const mergedAttributes: AttributeChip[] = [
        ...customAttrEntries.map((e) => ({ label: e.label, value: e.value })),
        ...descAttrChips,
      ].filter((chip, index, self) =>
        index === self.findIndex((c) => c.label === chip.label && c.value === chip.value)
      )

      const attrSearchStr = mergedAttributes.map((a) => `${a.label} ${a.value}`).join(' ')

      if (item.kind === CatalogItemKind.Service) {
        return {
          id: item.id,
          name: item.name,
          kind: 'service',
          stock: 0,
          price: item.basePrice ?? 0,
          qty: 1,
          item,
          totalStock: null,
          isBelowMinimum: false,
          warehouses: [],
          attributes: mergedAttributes,
          searchKey: `${item.sku ?? ''} ${item.name} ${item.description ?? ''} ${attrSearchStr}`.toLowerCase(),
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
        item,
        totalStock,
        isBelowMinimum,
        warehouses,
        attributes: mergedAttributes,
        searchKey: `${item.sku ?? ''} ${item.name} ${item.description ?? ''} ${attrSearchStr}`.toLowerCase(),
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



  const handleQuantityChange = (itemId: string, val: number) => {
    const qty = Math.max(1, val)
    setQuantities((prev) => ({
      ...prev,
      [itemId]: qty,
    }))
    // Al modificar cantidad, seleccionar automáticamente si no estaba marcado y tiene stock
    const targetRow = productsWithStock.find((p) => p.id === itemId)
    const isNoStock = targetRow?.kind === 'physical' && (targetRow?.totalStock ?? 0) <= 0
    if (!isNoStock && !selectedIds.has(itemId)) {
      setSelectedIds((prev) => new Set(prev).add(itemId))
    }
  }

  const handleConfirmSelection = () => {
    if (selectedIds.size === 0) return

    const itemsToProcess = productsWithStock.filter((p) => selectedIds.has(p.id))

    // Si se especificó targetLineId (reemplazar una línea específica), procesamos la primera selección sobre targetLineId
    // y el resto como nuevas líneas.
    itemsToProcess.forEach((row, index) => {
      const qty = quantities[row.id] ?? 1
      const currentTargetLine = index === 0 ? targetLineId : null
      onSelectProduct(row.item, qty, currentTargetLine)
    })

    onClose()
  }

  const columns = useMemo(
    (): ColumnDef<ProductStockRow>[] => [
      {
        key: 'select',
        header: '',
        width: 48,
        align: 'center',
        renderCell: (_v: unknown, row: ProductStockRow) => {
          const isNoStock = row.kind === 'physical' && (row.totalStock ?? 0) <= 0
          const isSelected = selectedIds.has(row.id)
          return (
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isNoStock}
              onChange={() => {
                if (isNoStock) return
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(row.id)) next.delete(row.id)
                  else next.add(row.id)
                  return next
                })
              }}
              aria-label={`Seleccionar ${row.name}`}
              title={isNoStock ? 'Sin existencia en stock (no disponible para facturar)' : `Seleccionar ${row.name}`}
              style={{
                cursor: isNoStock ? 'not-allowed' : 'pointer',
                opacity: isNoStock ? 0.35 : 1,
                width: 17,
                height: 17,
                accentColor: 'var(--shell-primary)',
              }}
            />
          )
        },
      },
      {
        key: 'name',
        header: 'Ítem / Producto y Detalles',
        sortable: true,
        renderCell: (_v: unknown, row: ProductStockRow) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.2rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {row.item.sku && (
                <span
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    color: 'var(--shell-primary)',
                    backgroundColor: 'rgba(var(--shell-primary-rgb), 0.08)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                  }}
                >
                  {row.item.sku}
                </span>
              )}
              <strong style={{ color: 'var(--glb-text)', fontSize: '0.88rem' }}>
                {row.item.name}
              </strong>
            </div>

            {row.item.description && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  color: 'var(--glb-muted)',
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {row.item.description}
              </p>
            )}

            {row.attributes.length > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                {row.attributes.map((attr, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.08rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--glb-surface-variant, rgba(255,255,255,0.06))',
                      border: '1px solid var(--shell-border, rgba(255,255,255,0.1))',
                      color: 'var(--glb-text)',
                      fontWeight: 500,
                    }}
                  >
                    {attr.label ? `${attr.label}: ${attr.value}` : attr.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'kind',
        header: 'Tipo',
        width: 95,
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
        width: 170,
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
        width: 105,
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
        renderCell: (_v: unknown, row: ProductStockRow) => {
          const isNoStock = row.kind === 'physical' && (row.totalStock ?? 0) <= 0
          return (
            <div style={{ width: '64px', margin: '0 auto', opacity: isNoStock ? 0.4 : 1 }}>
              <NumberBox
                size="sm"
                min={1}
                step={1}
                disabled={isNoStock}
                value={quantities[row.item.id] ?? 1}
                onChange={(e) => handleQuantityChange(row.item.id, Number(e.target.value) || 1)}
                fullWidth
              />
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quantities, selectedIds]
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

  const selectedCount = selectedIds.size

  return (
    <Popup
      open={open}
      title="Selección Múltiple de Productos y Stock"
      onClose={onClose}
      width="min(96vw, 82rem)"
      actions={[
        {
          id: 'close',
          label: 'Cancelar',
          variant: 'outline',
          onClick: onClose,
        },
        {
          id: 'apply',
          label: selectedCount > 0 ? `Aceptar y agregar (${selectedCount})` : 'Aceptar',
          variant: 'primary',
          disabled: selectedCount === 0,
          onClick: handleConfirmSelection,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <p className="ecu-modal-section-lead" style={{ margin: 0 }}>
            {targetLineId
              ? 'Selecciona uno o más ítems para agregarlos o reemplazar la línea actual.'
              : 'Marca los casilleros de los productos que deseas facturar, ajusta cantidades y presiona Aceptar.'}
          </p>

          {selectedCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--shell-primary)',
                  backgroundColor: 'rgba(var(--shell-primary-rgb), 0.1)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                }}
              >
                {selectedCount} producto(s) seleccionado(s)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                title="Limpiar selección"
              >
                <X size={14} strokeWidth={2} aria-hidden /> Limpiar
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="ecu-modal-section-lead" style={{ textAlign: 'center', padding: '3rem 0' }}>
            Cargando catálogo y saldos de stock…
          </p>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            className="ecu-empty-state--compact"
            icon={<Package size={24} strokeWidth={1.75} aria-hidden />}
            title="No se encontraron productos"
            description="No hay ítems que coincidan con los filtros o la búsqueda."
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
            searchWidth={340}
            searchPlaceholder="Buscar por SKU, nombre, descripción o talla…"
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
