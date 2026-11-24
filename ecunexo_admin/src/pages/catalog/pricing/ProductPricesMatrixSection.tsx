import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  Button,
  CheckButton,
  DataGrid,
  DateBox,
  NumberBox,
  Popup,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
} from 'glubox'
import { Download, Layers, Search, X } from 'lucide-react'
import { EmptyState, GridToolbarRefresh, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import '@/pages/catalog/pricing/productPricesMatrix.css'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import {
  calculateMarginPercent,
  formatMoney,
  todayIso,
  volumeSchemeTypeLabel,
} from '@/pages/catalog/pricing/pricingFormat'
import { bulkUpdateCatalogItemCosts } from '@/services/catalogApi'
import {
  assignVolumeDiscountScheme,
  bulkUpsertMatrixPrices,
  getProductPriceMatrix,
  listVolumeDiscountSchemes,
} from '@/services/pricingApi'
import type {
  PriceListDto,
  ProductPriceMatrixCellDto,
  ProductPriceMatrixRowDto,
  VolumeDiscountSchemeDto,
} from '@/types/pricingApi'

type MatrixRow = ProductPriceMatrixRowDto & {
  id: string
} & Record<string, unknown>

type BulkOperation = 'percentIncrease' | 'percentDecrease' | 'fixed' | 'copy'

type PreviewRow = {
  itemId: string
  itemLabel: string
  listId: string
  listCode: string
  before: number | null
  after: number
}

const gridMessages = createSpanishDataGridMessages('producto', 'productos')

const BULK_OPERATION_OPTIONS = [
  { value: 'percentIncrease', label: 'Aumentar %' },
  { value: 'percentDecrease', label: 'Disminuir %' },
  { value: 'fixed', label: 'Precio fijo' },
  { value: 'copy', label: 'Copiar de otra lista' },
]

function parsePriceInput(raw: string): number | null {
  const value = Number(raw.replace(',', '.'))
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function ProductPricesMatrixSection({
  tenantId,
  canManage,
}: {
  readonly tenantId: string
  readonly canManage: boolean
}) {
  const toast = useToast()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const [activeLists, setActiveLists] = useState<PriceListDto[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('all')
  const [schemes, setSchemes] = useState<VolumeDiscountSchemeDto[]>([])
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalSellableItems, setTotalSellableItems] = useState(0)
  const [itemsMissingAnyPrice, setItemsMissingAnyPrice] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyCells, setBusyCells] = useState<Set<string>>(new Set())

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [validFrom, setValidFrom] = useState(todayIso())
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Quick bulk price bar
  const [quickListId, setQuickListId] = useState('__all__')
  const [quickPrice, setQuickPrice] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)

  // Quick bulk volume scheme assignment
  const [targetSchemeId, setTargetSchemeId] = useState('')
  const [assigningScheme, setAssigningScheme] = useState(false)

  // Bulk adjustment modal
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkOperation, setBulkOperation] = useState<BulkOperation>('percentIncrease')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkSourceListId, setBulkSourceListId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      onPageChange(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput, onPageChange])

  useEffect(() => {
    let active = true
    listVolumeDiscountSchemes(tenantId, true)
      .then((data) => {
        if (active) setSchemes(data)
      })
      .catch(() => {
        if (active) setSchemes([])
      })
    return () => {
      active = false
    }
  }, [tenantId])

  const effectiveVisibleLists = useMemo(() => {
    if (selectedListId === 'all') return activeLists
    const found = activeLists.filter((l) => l.id === selectedListId)
    return found.length > 0 ? found : activeLists
  }, [activeLists, selectedListId])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        const res = await getProductPriceMatrix(tenantId, {
          page: paging.pageIndex + 1,
          pageSize: paging.pageSize,
          search: debouncedSearch || undefined,
          onlyMissing,
          priceListIds: selectedListId === 'all' ? undefined : [selectedListId],
          date: validFrom || undefined,
        })
        setActiveLists(res.priceLists)
        setRows(
          res.items.map((item) => ({
            ...item,
            id: item.catalogItemId,
          }))
        )
        setTotalCount(res.totalCount)
        setTotalSellableItems(res.totalSellableItems)
        setItemsMissingAnyPrice(res.itemsMissingAnyPrice)
      } catch (err: unknown) {
        setError(readApiError(err, 'No se pudo cargar la matriz de precios.'))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [debouncedSearch, onlyMissing, paging.pageIndex, paging.pageSize, selectedListId, tenantId, validFrom]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const markCellBusy = (key: string, busy: boolean) => {
    setBusyCells((prev) => {
      const next = new Set(prev)
      if (busy) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const saveCell = useCallback(
    async (row: MatrixRow, list: PriceListDto, rawValue: string) => {
      if (!canManage) return
      const trimmed = rawValue.trim()
      if (!trimmed) return
      const numeric = parsePriceInput(trimmed)
      if (numeric === null) {
        toast.show({
          title: 'Precio inválido',
          message: 'Ingresa un número mayor o igual a cero.',
          variant: 'error',
        })
        return
      }

      const targetRows =
        selectedIds.length > 1 && selectedIds.includes(row.id)
          ? rows.filter((r) => selectedIds.includes(r.id))
          : [row]

      for (const r of targetRows) {
        markCellBusy(`${r.id}:${list.id}`, true)
      }

      try {
        await bulkUpsertMatrixPrices(tenantId, {
          validFrom,
          validTo: null,
          reason:
            targetRows.length > 1
              ? 'Actualización en lote desde matriz'
              : 'Actualización inline desde matriz',
          entries: targetRows.map((r) => ({
            priceListId: list.id,
            catalogItemId: r.catalogItemId,
            price: numeric,
          })),
        })

        await load({ silent: true })
        toast.show({
          title: 'Precio guardado',
          message:
            targetRows.length > 1
              ? `${list.code} → $${numeric.toFixed(2)} aplicado a ${targetRows.length} productos.`
              : `${row.sku ?? row.name} · ${list.code} → $${numeric.toFixed(2)}`,
          variant: 'success',
        })
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo guardar',
          message: readApiError(err, 'Intenta nuevamente.'),
          variant: 'error',
        })
      } finally {
        for (const r of targetRows) {
          markCellBusy(`${r.id}:${list.id}`, false)
        }
      }
    },
    [canManage, load, rows, selectedIds, tenantId, toast, validFrom]
  )

  const saveCostCell = useCallback(
    async (row: MatrixRow, rawValue: string) => {
      if (!canManage) return
      const trimmed = rawValue.trim()
      const parsed = trimmed === '' ? null : parsePriceInput(trimmed)
      if (trimmed !== '' && parsed === null) {
        toast.show({
          title: 'Costo inválido',
          message: 'Ingresa un número mayor o igual a cero.',
          variant: 'error',
        })
        return
      }

      const targetRows =
        selectedIds.length > 1 && selectedIds.includes(row.id)
          ? rows.filter((r) => selectedIds.includes(r.id))
          : [row]

      for (const r of targetRows) {
        markCellBusy(`${r.id}:cost`, true)
      }

      try {
        await bulkUpdateCatalogItemCosts(
          tenantId,
          targetRows.map((r) => ({ catalogItemId: r.catalogItemId, costPrice: parsed }))
        )
        await load({ silent: true })
        toast.show({
          title: 'Costo guardado',
          message:
            targetRows.length > 1
              ? `Costo ${parsed != null ? `$${parsed.toFixed(2)}` : 'limpiado'} aplicado a ${targetRows.length} productos.`
              : `${row.sku ?? row.name} → ${parsed != null ? `$${parsed.toFixed(2)}` : 'Sin costo'}`,
          variant: 'success',
        })
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo guardar el costo',
          message: readApiError(err, 'Intenta nuevamente.'),
          variant: 'error',
        })
      } finally {
        for (const r of targetRows) {
          markCellBusy(`${r.id}:cost`, false)
        }
      }
    },
    [canManage, load, rows, selectedIds, tenantId, toast]
  )

  const handleQuickApplyPrice = useCallback(async () => {
    if (!canManage || selectedIds.length === 0) return
    const numeric = parsePriceInput(quickPrice)
    if (numeric === null) {
      toast.show({
        title: 'Precio inválido',
        message: 'Ingresa un número mayor o igual a cero.',
        variant: 'error',
      })
      return
    }

    const targetLists =
      quickListId === '__all__'
        ? effectiveVisibleLists
        : activeLists.filter((l) => l.id === quickListId)
    if (targetLists.length === 0) return

    setQuickBusy(true)
    try {
      const entries = targetLists.flatMap((list) =>
        selectedIds.map((catalogItemId) => ({
          priceListId: list.id,
          catalogItemId,
          price: numeric,
        }))
      )

      const res = await bulkUpsertMatrixPrices(tenantId, {
        validFrom,
        validTo: null,
        reason: 'Actualización rápida desde matriz',
        entries,
      })

      await load({ silent: true })
      toast.show({
        title: 'Precios asignados en lote',
        message: `Se aplicó $${numeric.toFixed(2)} (${res.createdCount} creados, ${res.updatedCount} actualizados).`,
        variant: 'success',
      })
      setQuickPrice('')
    } catch (err: unknown) {
      toast.show({
        title: 'Error al aplicar precios',
        message: readApiError(err, 'No se pudieron aplicar los precios.'),
        variant: 'error',
      })
    } finally {
      setQuickBusy(false)
    }
  }, [activeLists, canManage, effectiveVisibleLists, load, quickListId, quickPrice, selectedIds, tenantId, toast, validFrom])

  const handleBulkAssignScheme = useCallback(async () => {
    if (!canManage || selectedIds.length === 0) return
    const targetLists =
      quickListId === '__all__'
        ? effectiveVisibleLists
        : activeLists.filter((l) => l.id === quickListId)
    if (targetLists.length === 0) return

    setAssigningScheme(true)
    try {
      let totalAssigned = 0
      for (const list of targetLists) {
        const result = await assignVolumeDiscountScheme(tenantId, {
          priceListId: list.id,
          volumeDiscountSchemeId: targetSchemeId || null,
          catalogItemIds: selectedIds,
        })
        totalAssigned += result.assignedCount
      }

      const schemeObj = schemes.find((s) => s.id === targetSchemeId)
      toast.show({
        title: targetSchemeId ? 'Escala asignada' : 'Escala removida',
        message: targetSchemeId
          ? `Se asignó «${schemeObj?.name ?? 'escala'}» a ${totalAssigned} registro(s).`
          : `Se removió la escala de volumen en ${totalAssigned} registro(s).`,
        variant: 'success',
      })
      await load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al asignar escala',
        message: readApiError(err, 'Intenta nuevamente.'),
        variant: 'error',
      })
    } finally {
      setAssigningScheme(false)
    }
  }, [activeLists, canManage, effectiveVisibleLists, load, quickListId, schemes, selectedIds, targetSchemeId, tenantId, toast])

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(r.id)),
    [rows, selectedIds]
  )

  const bulkPreview = useMemo((): PreviewRow[] => {
    if (!bulkOpen || selectedRows.length === 0) return []
    const numeric = parsePriceInput(bulkValue)
    const entries: PreviewRow[] = []

    for (const row of selectedRows) {
      const label = row.sku ? `${row.sku} · ${row.name}` : row.name
      for (const list of effectiveVisibleLists) {
        const cell = row.cells[list.id]
        const before = cell?.price ?? null
        let after: number | null = null

        if (bulkOperation === 'fixed') {
          after = numeric
        } else if (bulkOperation === 'percentIncrease' && numeric !== null && before !== null) {
          after = Math.round(before * (1 + numeric / 100) * 100) / 100
        } else if (bulkOperation === 'percentDecrease' && numeric !== null && before !== null) {
          after = Math.max(0, Math.round(before * (1 - numeric / 100) * 100) / 100)
        } else if (bulkOperation === 'copy' && bulkSourceListId && list.id !== bulkSourceListId) {
          const source = row.cells[bulkSourceListId]
          after = source ? source.price : null
        }

        if (after !== null) {
          entries.push({
            itemId: row.catalogItemId,
            itemLabel: label,
            listId: list.id,
            listCode: list.code,
            before,
            after,
          })
        }
      }
    }
    return entries
  }, [bulkOpen, bulkOperation, bulkSourceListId, bulkValue, effectiveVisibleLists, selectedRows])

  const handleBulkApply = useCallback(async () => {
    if (bulkPreview.length === 0) return
    setBulkBusy(true)
    try {
      const res = await bulkUpsertMatrixPrices(tenantId, {
        validFrom,
        validTo: null,
        reason: `Ajuste masivo desde matriz (${bulkOperation})`,
        entries: bulkPreview.map((entry) => ({
          priceListId: entry.listId,
          catalogItemId: entry.itemId,
          price: entry.after,
        })),
      })
      toast.show({
        title: 'Cambios aplicados',
        message: `${res.createdCount} creados, ${res.updatedCount} actualizados en una sola transacción.`,
        variant: 'success',
      })
      setBulkOpen(false)
      setSelectedIds([])
      await load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error en ajuste masivo',
        message: readApiError(err, 'No se pudieron aplicar los cambios.'),
        variant: 'error',
      })
    } finally {
      setBulkBusy(false)
    }
  }, [bulkOperation, bulkPreview, load, tenantId, toast, validFrom])

  const handleExportCsv = useCallback(() => {
    const header = ['SKU', 'Producto', 'Costo ref.', ...effectiveVisibleLists.map((l) => l.code)]
    const lines = rows.map((row) => [
      row.sku ?? '',
      row.name,
      row.referenceCost != null ? row.referenceCost.toFixed(2) : '',
      ...effectiveVisibleLists.map((list) => {
        const cell = row.cells[list.id]
        return cell ? cell.price.toFixed(2) : ''
      }),
    ])
    const csv = [header, ...lines]
      .map((line) => line.map((v) => escapeCsv(String(v))).join(','))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `matriz-precios-${validFrom}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [effectiveVisibleLists, rows, validFrom])

  const columns = useMemo((): ColumnDef<MatrixRow>[] => {
    const base: ColumnDef<MatrixRow>[] = [
      {
        key: 'sku',
        header: 'SKU',
        width: 140,
        renderCell: (_value, row) =>
          row.sku ? (
            <code className="ecu-code">{row.sku}</code>
          ) : (
            <span className="app-shell__muted">—</span>
          ),
      },
      {
        key: 'name',
        header: 'Producto',
        width: 260,
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong style={{ fontSize: '0.85rem' }}>{row.name}</strong>
            {row.volumeDiscountSchemeName ? (
              <span className="ecu-chip" style={{ fontSize: '0.7rem', padding: '1px 6px', width: 'fit-content' }}>
                {row.volumeDiscountSchemeName}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'referenceCost',
        header: 'Costo ref.',
        width: 130,
        align: 'right',
        renderCell: (_value, row) => (
          <MatrixCostCell
            referenceCost={row.referenceCost}
            costSource={row.costSource}
            busy={busyCells.has(`${row.id}:cost`)}
            editable={canManage}
            onCommit={(raw) => void saveCostCell(row, raw)}
          />
        ),
      },
      ...effectiveVisibleLists.map(
        (list): ColumnDef<MatrixRow> => ({
          key: `list-${list.id}` as unknown as 'cells',
          header: (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <strong>{list.name}</strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted)', fontWeight: 400 }}>
                {list.pricesIncludeTax ? 'IVA incl.' : 'Neto + IVA'}
              </span>
            </div>
          ) as unknown as string,
          width: 155,
          align: 'right',
          renderCell: (_value: unknown, row: MatrixRow) => (
            <MatrixPriceCell
              cell={row.cells[list.id]}
              referenceCost={row.referenceCost}
              busy={busyCells.has(`${row.id}:${list.id}`)}
              editable={canManage}
              onCommit={(raw) => void saveCell(row, list, raw)}
            />
          ),
        })
      ),
    ]
    return base
  }, [busyCells, canManage, effectiveVisibleLists, saveCell, saveCostCell])

  const columnOrder = useMemo(() => columns.map((c) => c.key), [columns])

  return (
    <>
      <div className="ecu-stat-grid" aria-label="Resumen de matriz de precios">
        <StatCard label="Productos vendibles" value={totalSellableItems} />
        <StatCard label="Con listas sin precio" value={itemsMissingAnyPrice} />
        <StatCard label="Listas activas" value={activeLists.length} />
      </div>

      <SectionCard
        className="ecu-section-card--stacked-header"
        title="Matriz de precios"
        action={
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              width: '100%',
            }}
          >
            <div style={{ minWidth: 200, maxWidth: 260 }}>
              <TextBox
                id="matrix-server-search"
                size="sm"
                variant="outline"
                placeholder="Buscar SKU o nombre…"
                value={searchInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                iconLeft={<Search size={14} />}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
              {activeLists.length > 1 ? (
                <div style={{ minWidth: 175 }}>
                  <Select
                    id="matrix-visible-lists"
                    aria-label="Filtrar por lista visible"
                    size="sm"
                    variant="outline"
                    options={[
                      { value: 'all', label: `Todas las listas (${activeLists.length})` },
                      ...activeLists.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
                    ]}
                    value={selectedListId}
                    onChange={(val) => {
                      setSelectedListId(String(val))
                      onPageChange(0)
                    }}
                  />
                </div>
              ) : null}
              <div style={{ width: 150 }} title="Vigente desde">
                <DateBox
                  id="matrix-valid-from"
                  variant="outline"
                  value={validFrom}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setValidFrom(e.target.value)
                    onPageChange(0)
                  }}
                  disabled={loading}
                  size="sm"
                />
              </div>
              <CheckButton
                variant="ghost"
                size="sm"
                checked={onlyMissing}
                onChange={(checked) => {
                  setOnlyMissing(checked)
                  onPageChange(0)
                }}
                disabled={loading}
              >
                Sin precio
              </CheckButton>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <GridToolbarRefresh size="md" loading={loading} onRefresh={() => void load({ silent: true })} />
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  aria-label="Exportar CSV"
                  title="Exportar CSV"
                  onClick={handleExportCsv}
                  disabled={rows.length === 0}
                >
                  <Download size={15} aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        }
      >
        {error ? (
          <div className="ecu-form-error-banner" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        ) : null}

        {selectedIds.length > 0 && canManage ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              backgroundColor: 'var(--shell-surface-subtle, rgba(37, 99, 235, 0.12))',
              border: '1px solid var(--shell-border, rgba(59, 130, 246, 0.3))',
              borderRadius: '8px',
              padding: '0.7rem 1rem',
              marginBottom: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <StatusBadge tone="primary">
                  {selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}
                </StatusBadge>
                <div style={{ width: 175 }}>
                  <Select
                    id="quick-bulk-list"
                    size="sm"
                    variant="outline"
                    options={[
                      { value: '__all__', label: 'Listas visibles' },
                      ...activeLists.map((l) => ({ value: l.id, label: l.name })),
                    ]}
                    value={quickListId}
                    onChange={(val) => setQuickListId(String(val))}
                  />
                </div>
                <div style={{ width: 110 }}>
                  <NumberBox
                    id="quick-bulk-price"
                    size="sm"
                    variant="outline"
                    placeholder="Precio 0.00"
                    value={quickPrice === '' ? '' : Number(quickPrice)}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuickPrice(e.target.value)}
                    min={0}
                    step={0.01}
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!quickPrice.trim() || Number(quickPrice) < 0 || quickBusy}
                  loading={quickBusy}
                  onClick={() => void handleQuickApplyPrice()}
                >
                  Asignar precio
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  iconLeft={<Layers size={14} />}
                  onClick={() => {
                    setBulkValue('')
                    setBulkSourceListId(effectiveVisibleLists[0]?.id ?? activeLists[0]?.id ?? '')
                    setBulkOpen(true)
                  }}
                >
                  Ajuste masivo…
                </Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {schemes.length > 0 ? (
                  <>
                    <div style={{ width: 210 }}>
                      <Select
                        id="matrix-bulk-scheme"
                        size="sm"
                        variant="outline"
                        options={[
                          { value: '', label: 'Quitar escala de volumen' },
                          ...schemes.map((s) => ({
                            value: s.id,
                            label: `${s.name} (${volumeSchemeTypeLabel(s.type)})`,
                          })),
                        ]}
                        value={targetSchemeId}
                        onChange={(val) => setTargetSchemeId(String(val))}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={assigningScheme}
                      loading={assigningScheme}
                      onClick={() => void handleBulkAssignScheme()}
                    >
                      Aplicar escala
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconLeft={<X size={14} />}
                  disabled={quickBusy || assigningScheme}
                  onClick={() => setSelectedIds([])}
                >
                  Deseleccionar
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {rows.length === 0 && !loading && !debouncedSearch && !onlyMissing ? (
          <EmptyState
            icon="sell"
            title="Sin productos para mostrar"
            description="Crea productos o servicios en el catálogo para asignarles precios en la matriz."
          />
        ) : (
          <>
            <DataGrid<MatrixRow>
              className="ecu-companies-grid ecu-grid--centered-headers"
              dataSource={rows}
              keyExpr="id"
              columns={columns}
              columnOrder={columnOrder}
              selectionMode="multiple"
              selectedRowIds={selectedIds}
              onSelectionChange={(selected) => setSelectedIds(selected.map((row) => row.id))}
              showSearch={false}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="server"
              totalRowCount={totalCount}
              layout="auto"
              loading={loading}
              messages={gridMessages}
            />

          </>
        )}
      </SectionCard>

      <Popup
        open={bulkOpen}
        title={`Ajuste masivo para ${selectedRows.length} producto(s)`}
        onClose={() => (bulkBusy ? undefined : setBulkOpen(false))}
        width="min(96vw, 60rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setBulkOpen(false),
            disabled: bulkBusy,
          },
          {
            id: 'apply',
            label: bulkBusy ? 'Aplicando…' : `Aplicar ${bulkPreview.length} cambios`,
            variant: 'primary',
            onClick: () => void handleBulkApply(),
            disabled: bulkBusy || bulkPreview.length === 0,
          },
        ]}
      >
        <div
          className="ecu-companies-form__grid ecu-companies-form__grid--3"
          style={{ marginBottom: '1rem' }}
        >
          <div className="ecu-companies-form__field">
            <Select
              id="matrix-bulk-operation"
              label="Operación"
              labelPosition="outlined"
              variant="outline"
              options={BULK_OPERATION_OPTIONS}
              value={bulkOperation}
              onChange={(value) => setBulkOperation(String(value) as BulkOperation)}
              disabled={bulkBusy}
              fullWidth
            />
          </div>
          {bulkOperation === 'copy' ? (
            <div className="ecu-companies-form__field">
              <Select
                id="matrix-bulk-source"
                label="Lista origen"
                labelPosition="outlined"
                variant="outline"
                options={activeLists.map((list) => ({
                  value: list.id,
                  label: `${list.code} · ${list.name}`,
                }))}
                value={bulkSourceListId}
                onChange={(value) => setBulkSourceListId(String(value))}
                disabled={bulkBusy}
                fullWidth
              />
            </div>
          ) : (
            <div className="ecu-companies-form__field">
              <NumberBox
                id="matrix-bulk-value"
                label={bulkOperation === 'fixed' ? 'Precio fijo' : 'Porcentaje (%)'}
                labelPosition="outlined"
                variant="outline"
                value={bulkValue === '' ? '' : Number(bulkValue)}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setBulkValue(e.target.value)}
                min={0}
                step={bulkOperation === 'fixed' ? 0.01 : 1}
                showSpinButtons
                disabled={bulkBusy}
                fullWidth
              />
            </div>
          )}
          <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
            <p className="ecu-companies-form__hint">
              Se aplica a las {effectiveVisibleLists.length} listas visibles de los productos
              seleccionados. Las celdas sin precio se omiten en porcentajes y se crean con precio
              fijo o copia.
            </p>
          </div>
        </div>

        <div style={{ maxHeight: '22rem', overflow: 'auto' }}>
          <table className="ecu-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Lista</th>
                <th style={{ textAlign: 'right' }}>Antes</th>
                <th style={{ textAlign: 'right' }}>Después</th>
              </tr>
            </thead>
            <tbody>
              {bulkPreview.slice(0, 200).map((entry) => (
                <tr key={`${entry.itemId}-${entry.listId}`}>
                  <td>{entry.itemLabel}</td>
                  <td>{entry.listCode}</td>
                  <td style={{ textAlign: 'right' }}>
                    {entry.before !== null ? `$${entry.before.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${entry.after.toFixed(2)}</td>
                </tr>
              ))}
              {bulkPreview.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center' }} className="app-shell__muted">
                    Define la operación y el valor para ver la previsualización.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {bulkPreview.length > 200 ? (
            <p className="ecu-companies-form__hint">
              Mostrando 200 de {bulkPreview.length} cambios; se aplicarán todos.
            </p>
          ) : null}
        </div>
      </Popup>
    </>
  )
}

function MatrixCostCell({
  referenceCost,
  costSource,
  busy,
  editable,
  onCommit,
}: {
  readonly referenceCost: number | null
  readonly costSource: 'stock' | 'catalog' | null
  readonly busy: boolean
  readonly editable: boolean
  readonly onCommit: (raw: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => {
    if (!editable || busy) return
    setDraft(referenceCost != null ? String(referenceCost) : '')
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    onCommit(draft)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={!editable || busy}
        title={editable ? 'Clic para editar el costo de catálogo' : 'Sin permiso para editar'}
        style={{
          background: 'transparent',
          border: 'none',
          color: referenceCost != null ? 'var(--glb-text)' : 'var(--glb-muted)',
          cursor: editable ? 'pointer' : 'default',
          padding: '0.2rem 0.4rem',
          borderRadius: 6,
          width: '100%',
          textAlign: 'right',
          opacity: busy ? 0.5 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {referenceCost != null ? (
          <>
            <span style={{ fontWeight: 600 }}>{formatMoney(referenceCost)}</span>
            <span className="app-shell__muted" style={{ fontSize: '0.68rem' }}>
              {costSource === 'stock' ? 'Kárdex' : 'Catálogo'}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '0.78rem' }}>+ Costo</span>
        )}
      </button>
    )
  }

  return (
    <TextBox
      id={`matrix-cost-${referenceCost ?? 'new'}`}
      size="sm"
      variant="outline"
      value={draft}
      autoFocus
      disabled={busy}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          setEditing(false)
        }
      }}
    />
  )
}

function MatrixPriceCell({
  cell,
  referenceCost,
  busy,
  editable,
  onCommit,
}: {
  readonly cell: ProductPriceMatrixCellDto | undefined
  readonly referenceCost: number | null
  readonly busy: boolean
  readonly editable: boolean
  readonly onCommit: (raw: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => {
    if (!editable || busy) return
    setDraft(cell ? String(cell.price) : '')
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    onCommit(draft)
  }

  if (!editing) {
    const margin = cell ? calculateMarginPercent(cell.price, referenceCost) : null
    const belowCost =
      cell && referenceCost != null && referenceCost > 0 && cell.price < referenceCost
    return (
      <button
        type="button"
        onClick={start}
        disabled={!editable || busy}
        title={editable ? 'Clic para editar el precio' : 'Sin permiso para editar'}
        style={{
          background: 'transparent',
          border: 'none',
          color: cell ? 'var(--glb-text)' : 'var(--glb-muted)',
          cursor: editable ? 'pointer' : 'default',
          fontWeight: cell ? 600 : 400,
          padding: '0.2rem 0.4rem',
          borderRadius: 6,
          width: '100%',
          textAlign: 'right',
          opacity: busy ? 0.5 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        <span>{cell ? `$${cell.price.toFixed(2)}` : '+ Agregar'}</span>
        {margin !== null ? (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: belowCost
                ? 'var(--color-danger, #ef4444)'
                : margin < 15
                  ? 'var(--color-warning, #d97706)'
                  : 'var(--color-success, #16a34a)',
            }}
          >
            {belowCost ? `Bajo costo (${margin.toFixed(0)}%)` : `Mg ${margin.toFixed(0)}%`}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <TextBox
      id={`matrix-cell-${cell?.priceId ?? 'new'}`}
      size="sm"
      variant="outline"
      value={draft}
      autoFocus
      disabled={busy}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          setEditing(false)
        }
      }}
    />
  )
}
