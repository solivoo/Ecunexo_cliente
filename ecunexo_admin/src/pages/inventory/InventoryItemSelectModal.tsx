import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, DataGrid, NumberBox, Popup, Select, TextBox, type ColumnDef } from 'glubox'
import { EmptyState } from '@/components/ui'
import { Boxes, Layers, Package, Search, X } from 'lucide-react'
import { formatVariantDisplayName } from '@/lib/catalogArchetype'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { listCatalogCategories, listCatalogItems } from '@/services/catalogApi'
import { listStock } from '@/services/inventoryApi'
import {
  CatalogItemKind,
  CatalogItemStatus,
  type CatalogItemListItemDto,
  type CategoryListItemDto,
} from '@/types/catalogApi'
import type { StockListItemDto } from '@/types/inventoryApi'
import './inventoryItemSelectModal.css'

export type InventoryItemSelectModalProps = {
  readonly open: boolean
  readonly onClose: () => void
  readonly tenantId: string | null
  readonly warehouseId: string
  readonly warehouseName?: string
  readonly initialMode?: 'search' | 'matrix'
  readonly onAddLines: (items: { catalogItemId: string; quantity: number }[]) => void
}

type ProductVariantRow = {
  id: string
  name: string
  parentName: string | null
  cleanDisplayName: string
  sku: string
  categoryName: string
  stock: number
  qty: number
  imageUrl: string | null
  item: CatalogItemListItemDto
  searchKey: string
  select?: boolean
  [key: string]: unknown
}

const messages = createSpanishDataGridMessages('ítem', 'ítems')

export function InventoryItemSelectModal({
  open,
  onClose,
  tenantId,
  warehouseId,
  warehouseName,
  initialMode = 'search',
  onAddLines,
}: InventoryItemSelectModalProps) {
  const [mode, setMode] = useState<'search' | 'matrix'>(() => initialMode)
  const [loading, setLoading] = useState(false)
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])
  const [categories, setCategories] = useState<CategoryListItemDto[]>([])
  const [stockItems, setStockItems] = useState<StockListItemDto[]>([])

  // Estado para pestaña Búsqueda
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'with_stock' | 'zero_stock'>('all')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  // Estado para pestaña Matriz
  const [selectedParentId, setSelectedParentId] = useState<string>('')
  const [matrixQuantities, setMatrixQuantities] = useState<Record<string, number>>({})
  const [bulkQty, setBulkQty] = useState<number>(0)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging(8)

  useEffect(() => {
    if (!open || !tenantId) return

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [items, cats, stocks] = await Promise.all([
          listCatalogItems(tenantId, CatalogItemKind.Physical, CatalogItemStatus.Active),
          listCatalogCategories(tenantId).catch(() => [] as CategoryListItemDto[]),
          warehouseId
            ? listStock(tenantId, { warehouseId }).catch(() => [] as StockListItemDto[])
            : Promise.resolve([] as StockListItemDto[]),
        ])

        if (!cancelled) {
          setCatalogItems(items)
          setCategories(cats)
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
  }, [open, tenantId, warehouseId])

  // Mapeo rápido de productos padre por ID
  const parentsMap = useMemo(() => {
    const map = new Map<string, CatalogItemListItemDto>()
    for (const item of catalogItems) {
      if (item.isMatrixParent) {
        map.set(item.id, item)
      }
    }
    return map
  }, [catalogItems])

  // Mapeo de stock por CatalogItemId
  const stockByItemId = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of stockItems) {
      map.set(s.catalogItemId, s.quantity)
    }
    return map
  }, [stockItems])

  // Lista de padres para selector en modo Matriz
  const parentOptions = useMemo(() => {
    const parents = catalogItems.filter((i) => i.isMatrixParent)
    return [
      { value: '', label: 'Seleccionar un producto matriz…' },
      ...parents.map((p) => {
        const childCount = catalogItems.filter((i) => i.parentId === p.id).length
        return {
          value: p.id,
          label: `${p.name} (${childCount} variantes)`,
        }
      }),
    ]
  }, [catalogItems])

  // Todas las variantes y productos físicos simples para modo Búsqueda
  const physicalVariantRows = useMemo<ProductVariantRow[]>(() => {
    const variants = catalogItems.filter((i) => !i.isMatrixParent && i.kind === CatalogItemKind.Physical)

    return variants.map((item) => {
      const parent = item.parentId ? parentsMap.get(item.parentId) : null
      const parentName = parent ? parent.name : null
      const cleanDisplayName = formatVariantDisplayName(item.name, parentName)
      const stock = stockByItemId.get(item.id) ?? 0

      const searchKey = `${item.sku ?? ''} ${item.name} ${parentName ?? ''} ${cleanDisplayName} ${item.categoryName ?? ''}`.toLowerCase()

      return {
        id: item.id,
        name: item.name,
        parentName,
        cleanDisplayName,
        sku: item.sku?.trim() || '—',
        categoryName: item.categoryName || 'Sin categoría',
        stock,
        qty: quantities[item.id] ?? 1,
        imageUrl: item.mainImageThumbUrl || parent?.mainImageThumbUrl || null,
        item,
        searchKey,
      }
    })
  }, [catalogItems, parentsMap, stockByItemId, quantities])

  // Filtros aplicados a pestaña Búsqueda
  const filteredSearchRows = useMemo(() => {
    return physicalVariantRows.filter((row) => {
      if (selectedCategoryId && row.item.categoryId !== selectedCategoryId) {
        return false
      }
      if (stockFilter === 'with_stock' && row.stock <= 0) {
        return false
      }
      if (stockFilter === 'zero_stock' && row.stock > 0) {
        return false
      }
      if (searchFilter.trim()) {
        const term = searchFilter.toLowerCase().trim()
        if (!row.searchKey.includes(term)) {
          return false
        }
      }
      return true
    })
  }, [physicalVariantRows, selectedCategoryId, stockFilter, searchFilter])

  // Variantes pertenecientes al padre seleccionado en modo Matriz
  const selectedParent = useMemo(() => {
    if (!selectedParentId) return null
    return parentsMap.get(selectedParentId) ?? null
  }, [selectedParentId, parentsMap])

  const matrixChildren = useMemo(() => {
    if (!selectedParentId) return []
    return catalogItems.filter((i) => i.parentId === selectedParentId)
  }, [selectedParentId, catalogItems])

  // Manejo de cantidades en Búsqueda
  const handleQuantityChange = useCallback((itemId: string, val: number) => {
    const qty = Math.max(1, val)
    setQuantities((prev) => ({ ...prev, [itemId]: qty }))
    setSelectedIds((prev) => new Set(prev).add(itemId))
  }, [])

  // Confirmar selección en modo Búsqueda
  const handleConfirmSearch = useCallback(() => {
    if (selectedIds.size === 0) return
    const linesToAdd: { catalogItemId: string; quantity: number }[] = []

    for (const id of selectedIds) {
      const qty = quantities[id] ?? 1
      linesToAdd.push({ catalogItemId: id, quantity: qty })
    }

    onAddLines(linesToAdd)
    onClose()
  }, [selectedIds, quantities, onAddLines, onClose])

  // Manejo de matriz
  const handleMatrixQtyChange = useCallback((variantId: string, val: number) => {
    const qty = Math.max(0, val)
    setMatrixQuantities((prev) => ({ ...prev, [variantId]: qty }))
  }, [])

  const handleApplyBulkQty = useCallback(() => {
    if (bulkQty <= 0) return
    const next: Record<string, number> = {}
    for (const child of matrixChildren) {
      next[child.id] = bulkQty
    }
    setMatrixQuantities(next)
  }, [bulkQty, matrixChildren])

  const handleClearMatrixQty = useCallback(() => {
    setMatrixQuantities({})
  }, [])

  // Confirmar selección en modo Matriz
  const handleConfirmMatrix = useCallback(() => {
    const linesToAdd: { catalogItemId: string; quantity: number }[] = []

    for (const child of matrixChildren) {
      const qty = matrixQuantities[child.id] ?? 0
      if (qty > 0) {
        linesToAdd.push({ catalogItemId: child.id, quantity: qty })
      }
    }

    if (linesToAdd.length === 0) return
    onAddLines(linesToAdd)
    onClose()
  }, [matrixChildren, matrixQuantities, onAddLines, onClose])

  const totalMatrixLinesToAdd = useMemo(() => {
    return matrixChildren.filter((c) => (matrixQuantities[c.id] ?? 0) > 0).length
  }, [matrixChildren, matrixQuantities])

  const totalMatrixUnitsToAdd = useMemo(() => {
    return matrixChildren.reduce((acc, c) => acc + (matrixQuantities[c.id] ?? 0), 0)
  }, [matrixChildren, matrixQuantities])

  // Columnas de DataGrid en Búsqueda
  const searchColumns = useMemo(
    (): ColumnDef<ProductVariantRow>[] => [
      {
        key: 'select',
        header: '',
        width: 48,
        align: 'center',
        renderCell: (_v: unknown, row: ProductVariantRow) => {
          const isSelected = selectedIds.has(row.id)
          return (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(row.id)) next.delete(row.id)
                  else next.add(row.id)
                  return next
                })
              }}
              aria-label={`Seleccionar ${row.name}`}
              style={{
                cursor: 'pointer',
                width: 17,
                height: 17,
                accentColor: 'var(--shell-primary)',
              }}
            />
          )
        },
      },
      {
        key: 'sku',
        header: 'SKU',
        width: 140,
        sortable: true,
        renderCell: (v: unknown) => <code className="ecu-code">{String(v || '—')}</code>,
      },
      {
        key: 'item',
        header: 'Artículo / Variante',
        sortable: true,
        renderCell: (_v: unknown, row: ProductVariantRow) => (
          <div className="ecu-inv-modal__item-cell">
            {row.imageUrl ? (
              <img
                src={row.imageUrl}
                alt=""
                className="ecu-inv-modal__item-thumb"
                loading="lazy"
              />
            ) : (
              <div className="ecu-inv-modal__item-thumb">
                <Package size={18} strokeWidth={1.5} aria-hidden />
              </div>
            )}
            <div className="ecu-inv-modal__item-details">
              {row.parentName ? (
                <span className="ecu-inv-modal__parent-name">{row.parentName}</span>
              ) : null}
              <span className="ecu-inv-modal__item-name" title={row.name}>
                {row.cleanDisplayName !== '—' ? row.cleanDisplayName : row.name}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'stock',
        header: `Stock (${warehouseName || 'Bodega'})`,
        width: 140,
        align: 'center',
        sortable: true,
        renderCell: (v: unknown) => {
          const val = Number(v) || 0
          return (
            <span
              className={`ecu-inv-modal__stock-badge ${
                val === 0 ? 'ecu-inv-modal__stock-badge--zero' : ''
              }`}
            >
              {val} un.
            </span>
          )
        },
      },
      {
        key: 'qty',
        header: 'Cantidad a ingresar',
        width: 150,
        align: 'center',
        renderCell: (_v: unknown, row: ProductVariantRow) => (
          <NumberBox
            id={`inv-modal-qty-${row.id}`}
            aria-label={`Cantidad para ${row.name}`}
            variant="outline"
            size="sm"
            min={1}
            step={1}
            showSpinButtons
            value={quantities[row.id] ?? 1}
            onChange={(e) => handleQuantityChange(row.id, Number(e.target.value))}
            style={{ width: '100px', margin: '0 auto' }}
          />
        ),
      },
    ],
    [selectedIds, quantities, warehouseName, handleQuantityChange]
  )

  const selectedCount = selectedIds.size

  return (
    <Popup
      open={open}
      title="Catálogo de Artículos y Variantes"
      onClose={onClose}
      width="min(96vw, 84rem)"
      actions={[
        {
          id: 'close',
          label: 'Cancelar',
          variant: 'outline',
          onClick: onClose,
        },
        ...(mode === 'search'
          ? [
              {
                id: 'apply-search',
                label:
                  selectedCount > 0
                    ? `Agregar seleccionados (${selectedCount})`
                    : 'Agregar seleccionados',
                variant: 'primary' as const,
                disabled: selectedCount === 0,
                onClick: handleConfirmSearch,
              },
            ]
          : [
              {
                id: 'apply-matrix',
                label:
                  totalMatrixLinesToAdd > 0
                    ? `Cargar al documento (${totalMatrixLinesToAdd} variantes · ${totalMatrixUnitsToAdd} un.)`
                    : 'Cargar al documento',
                variant: 'primary' as const,
                disabled: totalMatrixLinesToAdd === 0,
                onClick: handleConfirmMatrix,
              },
            ]),
      ]}
    >
      <div className="ecu-inv-modal__wrap">
        <div className="ecu-inv-modal__header">
          <div className="ecu-inv-modal__tabs" role="tablist" aria-label="Modo de selección">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'search'}
              className={`ecu-inv-modal__tab-btn ${
                mode === 'search' ? 'ecu-inv-modal__tab-btn--active' : ''
              }`}
              onClick={() => setMode('search')}
            >
              <Boxes size={16} strokeWidth={1.75} aria-hidden />
              Búsqueda de SKUs / Variantes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'matrix'}
              className={`ecu-inv-modal__tab-btn ${
                mode === 'matrix' ? 'ecu-inv-modal__tab-btn--active' : ''
              }`}
              onClick={() => setMode('matrix')}
            >
              <Layers size={16} strokeWidth={1.75} aria-hidden />
              Recepción por Modelo / Matriz
            </button>
          </div>

          {mode === 'search' && selectedCount > 0 ? (
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
                {selectedCount} ítem(s) seleccionado(s)
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
          ) : null}
        </div>

        {loading ? (
          <p className="ecu-modal-section-lead" style={{ textAlign: 'center', padding: '3rem 0' }}>
            Cargando catálogo físico y existencias…
          </p>
        ) : mode === 'search' ? (
          /* Modo Búsqueda por SKU / Variantes */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="ecu-inv-modal__toolbar">
              <div className="ecu-inv-modal__filters">
                <div className="ecu-inv-modal__search-box">
                  <TextBox
                    id="inv-modal-search"
                    placeholder="Buscar por SKU, nombre, modelo o talla…"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    variant="outline"
                    size="sm"
                    fullWidth
                  />
                </div>

                {categories.length > 0 ? (
                  <div style={{ width: '220px' }}>
                    <Select
                      id="inv-modal-cat"
                      variant="outline"
                      size="sm"
                      options={[
                        { value: '', label: 'Todas las categorías' },
                        ...categories.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                      value={selectedCategoryId}
                      onChange={setSelectedCategoryId}
                      fullWidth
                    />
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <Button
                    type="button"
                    variant={stockFilter === 'all' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setStockFilter('all')}
                  >
                    Todos
                  </Button>
                  <Button
                    type="button"
                    variant={stockFilter === 'with_stock' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setStockFilter('with_stock')}
                  >
                    Con stock
                  </Button>
                  <Button
                    type="button"
                    variant={stockFilter === 'zero_stock' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setStockFilter('zero_stock')}
                  >
                    Sin stock (0)
                  </Button>
                </div>
              </div>

              {filteredSearchRows.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allIds = new Set(filteredSearchRows.map((r) => r.id))
                    setSelectedIds(allIds)
                  }}
                >
                  Seleccionar visibles ({filteredSearchRows.length})
                </Button>
              ) : null}
            </div>

            {filteredSearchRows.length === 0 ? (
              <EmptyState
                className="ecu-empty-state--compact"
                icon={<Search size={24} strokeWidth={1.75} aria-hidden />}
                title="No se encontraron ítems físicos"
                description="Prueba con otros términos de búsqueda o filtros de categoría."
              />
            ) : (
              <DataGrid<ProductVariantRow>
                className="ecu-companies-grid"
                dataSource={filteredSearchRows}
                keyExpr="id"
                columns={searchColumns}
                selectionMode="none"
                paging={paging}
                paginationMode="client"
                pageSizeOptions={pageSizeOptions}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                messages={messages}
              />
            )}
          </div>
        ) : (
          /* Modo Recepción Matricial (Matrix Ingress) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ecu-inv-matrix__selector-card">
              <div style={{ maxWidth: '480px' }}>
                <Select
                  id="inv-parent-select"
                  label="Producto Matriz / Modelo del Arquetipo"
                  labelPosition="outlined"
                  variant="outline"
                  options={parentOptions}
                  value={selectedParentId}
                  onChange={(val) => {
                    setSelectedParentId(val)
                    setMatrixQuantities({})
                  }}
                  fullWidth
                />
              </div>

              {selectedParent ? (
                <div className="ecu-inv-matrix__model-info">
                  <div className="ecu-inv-matrix__model-meta-item">
                    <span>Categoría</span>
                    <span>{selectedParent.categoryName || 'Sin categoría'}</span>
                  </div>
                  {selectedParent.familyName ? (
                    <div className="ecu-inv-matrix__model-meta-item">
                      <span>Plantilla / Arquetipo</span>
                      <span>{selectedParent.familyName}</span>
                    </div>
                  ) : null}
                  <div className="ecu-inv-matrix__model-meta-item">
                    <span>Total de Variantes</span>
                    <span>{matrixChildren.length} SKUs activos</span>
                  </div>
                </div>
              ) : null}
            </div>

            {!selectedParent ? (
              <EmptyState
                className="ecu-empty-state--compact"
                icon={<Layers size={24} strokeWidth={1.75} aria-hidden />}
                title="Selecciona un Producto Matriz"
                description="Elige un producto arriba para desplegar su matriz de variantes físicas y cargar stock rápidamente."
              />
            ) : matrixChildren.length === 0 ? (
              <EmptyState
                className="ecu-empty-state--compact"
                icon={<Package size={24} strokeWidth={1.75} aria-hidden />}
                title="Este producto no tiene variantes físicas"
                description="Crea variantes en la ficha del catálogo o selecciónalo directamente en la pestaña Búsqueda."
              />
            ) : (
              <>
                <div className="ecu-inv-matrix__bulk-bar">
                  <div className="ecu-inv-matrix__bulk-controls">
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--glb-muted)' }}>
                      Fijar cantidad común en todas:
                    </span>
                    <div style={{ width: '90px' }}>
                      <NumberBox
                        id="inv-bulk-qty"
                        size="sm"
                        variant="outline"
                        min={1}
                        step={1}
                        value={bulkQty}
                        onChange={(e) => setBulkQty(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleApplyBulkQty}>
                      Aplicar a todas
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleClearMatrixQty}>
                      Limpiar
                    </Button>
                  </div>

                  <span style={{ fontSize: '0.82rem', color: 'var(--glb-muted)' }}>
                    {matrixChildren.length} variantes físicas disponibles
                  </span>
                </div>

                <div className="ecu-inv-matrix__table-wrap">
                  <table className="ecu-inv-matrix__table">
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: '48px', textAlign: 'center' }}>#</th>
                        <th scope="col" style={{ width: '160px' }}>SKU</th>
                        <th scope="col">Variante / Atributos</th>
                        <th scope="col" style={{ width: '160px', textAlign: 'center' }}>
                          Stock ({warehouseName || 'Bodega'})
                        </th>
                        <th scope="col" style={{ width: '160px', textAlign: 'center' }}>
                          Cantidad a ingresar
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixChildren.map((child, index) => {
                        const stock = stockByItemId.get(child.id) ?? 0
                        const qty = matrixQuantities[child.id] ?? 0
                        const displayName = formatVariantDisplayName(child.name, selectedParent.name)

                        return (
                          <tr key={child.id}>
                            <td style={{ textAlign: 'center', color: 'var(--glb-muted)' }}>
                              {index + 1}
                            </td>
                            <td>
                              <code className="ecu-code">{child.sku || '—'}</code>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{displayName}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className={`ecu-inv-modal__stock-badge ${
                                  stock === 0 ? 'ecu-inv-modal__stock-badge--zero' : ''
                                }`}
                              >
                                {stock} un.
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <NumberBox
                                id={`inv-matrix-qty-${child.id}`}
                                aria-label={`Cantidad ${displayName}`}
                                variant="outline"
                                size="sm"
                                min={0}
                                step={1}
                                showSpinButtons
                                value={qty}
                                onChange={(e) =>
                                  handleMatrixQtyChange(child.id, Number(e.target.value) || 0)
                                }
                                style={{ width: '100px', margin: '0 auto' }}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="ecu-inv-matrix__summary-bar">
                  <div>
                    <strong>Resumen a cargar: </strong>
                    <span>
                      {totalMatrixLinesToAdd} de {matrixChildren.length} variantes seleccionadas
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--shell-primary)' }}>
                    Total: {totalMatrixUnitsToAdd} unidades
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Popup>
  )
}
