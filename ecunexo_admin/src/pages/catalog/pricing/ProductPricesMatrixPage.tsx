import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button, CheckButton, DataGrid, DateBox, NumberBox, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import { Download, Layers } from 'lucide-react'
import {
  EmptyState,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { todayIso } from '@/pages/catalog/pricing/pricingFormat'
import { listCatalogItems } from '@/services/catalogApi'
import {
  bulkCreateProductPrices,
  createProductPrice,
  listPriceLists,
  listProductPrices,
  updateProductPrice,
} from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { PriceListDto } from '@/types/pricingApi'

type MatrixCell = {
  priceId: string
  price: number
  validFrom: string
}

type MatrixRow = CatalogItemListItemDto & {
  matrix: Record<string, MatrixCell | undefined>
}

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

export function ProductPricesMatrixPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('catalog.pricing.read')
  const canManage = useHasPermission('catalog.pricing.create')
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const [lists, setLists] = useState<PriceListDto[]>([])
  const [items, setItems] = useState<CatalogItemListItemDto[]>([])
  const [matrix, setMatrix] = useState<Map<string, Record<string, MatrixCell | undefined>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyCells, setBusyCells] = useState<Set<string>>(new Set())
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [validFrom, setValidFrom] = useState(todayIso())
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkOperation, setBulkOperation] = useState<BulkOperation>('percentIncrease')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkSourceListId, setBulkSourceListId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const activeLists = useMemo(() => lists.filter((list) => list.isActive), [lists])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        const [catalog, priceLists] = await Promise.all([
          listCatalogItems(tenantId, { includeParents: false }),
          listPriceLists(tenantId, true),
        ])
        const active = priceLists.filter((list) => list.isActive)
        const pricesByList = await Promise.all(
          active.map((list) =>
            listProductPrices(tenantId, { priceListId: list.id, onlyVigent: true }).then(
              (rows) => ({ listId: list.id, rows })
            )
          )
        )

        const nextMatrix = new Map<string, Record<string, MatrixCell | undefined>>()
        for (const { listId, rows } of pricesByList) {
          for (const row of rows) {
            const entry = nextMatrix.get(row.catalogItemId) ?? {}
            entry[listId] = {
              priceId: row.id,
              price: row.price,
              validFrom: row.validFrom,
            }
            nextMatrix.set(row.catalogItemId, entry)
          }
        }

        setLists(priceLists)
        setItems(catalog.filter((item) => item.kind === CatalogItemKind.Physical))
        setMatrix(nextMatrix)
      } catch (err: unknown) {
        if (!opts?.silent) setError(readApiError(err, 'No se pudo cargar la matriz de precios.'))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [tenantId]
  )

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo<MatrixRow[]>(
    () =>
      items.map((item) => ({
        ...item,
        matrix: matrix.get(item.id) ?? {},
      })),
    [items, matrix]
  )

  const visibleRows = useMemo(() => {
    if (!onlyMissing) return rows
    return rows.filter((row) =>
      activeLists.some((list) => row.matrix[list.id] === undefined)
    )
  }, [activeLists, onlyMissing, rows])

  const coverage = useMemo(() => {
    const total = rows.length
    return activeLists.map((list) => ({
      list,
      withPrice: rows.filter((row) => row.matrix[list.id] !== undefined).length,
      total,
    }))
  }, [activeLists, rows])

  const markCellBusy = (cellKey: string, busy: boolean) => {
    setBusyCells((prev) => {
      const next = new Set(prev)
      if (busy) next.add(cellKey)
      else next.delete(cellKey)
      return next
    })
  }

  const [quickPrice, setQuickPrice] = useState('')
  const [quickListId, setQuickListId] = useState('__all__')
  const [quickBusy, setQuickBusy] = useState(false)

  const saveCell = useCallback(
    async (row: MatrixRow, list: PriceListDto, raw: string) => {
      if (!tenantId || !canManage) return
      const value = parsePriceInput(raw)
      if (value === null) {
        toast.show({ title: 'Precio inválido', message: 'Ingresa un número mayor o igual a cero.', variant: 'error' })
        return
      }

      // Si la fila editada forma parte de una selección múltiple, aplicar el precio a todos los seleccionados
      const targetRows = selectedIds.includes(row.id) && selectedIds.length > 1
        ? rows.filter((r) => selectedIds.includes(r.id))
        : [row]

      for (const r of targetRows) {
        markCellBusy(`${r.id}:${list.id}`, true)
      }

      try {
        const toCreate: MatrixRow[] = []
        for (const r of targetRows) {
          const current = r.matrix[list.id]
          if (current && current.validFrom === validFrom) {
            await updateProductPrice(tenantId, current.priceId, {
              price: value,
              validFrom,
              validTo: null,
              reason: 'Actualización desde matriz de precios',
              isActive: true,
              tiers: [],
            })
          } else {
            toCreate.push(r)
          }
        }

        if (toCreate.length === 1) {
          const single = toCreate[0]
          await createProductPrice(tenantId, {
            priceListId: list.id,
            catalogItemId: single.id,
            price: value,
            validFrom,
            validTo: null,
            reason: 'Actualización desde matriz de precios',
            tiers: [],
            isActive: true,
          })
        } else if (toCreate.length > 1) {
          await bulkCreateProductPrices(tenantId, {
            priceListId: list.id,
            validFrom,
            validTo: null,
            reason: 'Actualización masiva desde matriz de precios',
            items: toCreate.map((r) => ({
              catalogItemId: r.id,
              price: value,
            })),
          })
        }

        await load({ silent: true })

        if (targetRows.length > 1) {
          toast.show({
            title: 'Precios actualizados',
            message: `$${value.toFixed(2)} aplicado a los ${targetRows.length} productos seleccionados en ${list.code}.`,
            variant: 'success',
          })
        } else {
          toast.show({
            title: 'Precio guardado',
            message: `${row.sku ?? row.name} · ${list.code} → $${value.toFixed(2)}`,
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo guardar',
          message: readApiError(err, 'Revisa la vigencia e intenta nuevamente.'),
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

  const handleQuickApplyPrice = useCallback(async () => {
    if (!tenantId || !canManage || selectedIds.length === 0) return
    const numeric = parsePriceInput(quickPrice)
    if (numeric === null) {
      toast.show({ title: 'Precio inválido', message: 'Ingresa un número mayor o igual a cero.', variant: 'error' })
      return
    }

    setQuickBusy(true)
    try {
      const targetLists = quickListId === '__all__'
        ? activeLists
        : activeLists.filter((l) => l.id === quickListId)

      for (const list of targetLists) {
        const toCreate: string[] = []
        for (const id of selectedIds) {
          const cell = matrix.get(id)?.[list.id]
          if (cell && cell.validFrom === validFrom) {
            await updateProductPrice(tenantId, cell.priceId, {
              price: numeric,
              validFrom,
              validTo: null,
              reason: 'Actualización rápida desde matriz',
              isActive: true,
              tiers: [],
            })
          } else {
            toCreate.push(id)
          }
        }

        if (toCreate.length > 0) {
          await bulkCreateProductPrices(tenantId, {
            priceListId: list.id,
            validFrom,
            validTo: null,
            reason: 'Actualización rápida desde matriz',
            items: toCreate.map((catalogItemId) => ({
              catalogItemId,
              price: numeric,
            })),
          })
        }
      }

      await load({ silent: true })
      toast.show({
        title: 'Precios asignados en lote',
        message: `Se aplicó $${numeric.toFixed(2)} a ${selectedIds.length} producto(s) en ${targetLists.length} lista(s).`,
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
  }, [activeLists, canManage, load, matrix, quickListId, quickPrice, selectedIds, tenantId, toast, validFrom])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  )

  const bulkPreview = useMemo<PreviewRow[]>(() => {
    if (!bulkOpen || selectedRows.length === 0) return []
    const numeric = parsePriceInput(bulkValue)
    const preview: PreviewRow[] = []

    for (const row of selectedRows) {
      const itemLabel = [row.sku, row.description?.trim() || row.name].filter(Boolean).join(' · ')
      for (const list of activeLists) {
        if (bulkOperation === 'copy' && list.id === bulkSourceListId) continue
        const current = row.matrix[list.id]
        let after: number | null = null

        if (bulkOperation === 'fixed') {
          after = numeric
        } else if (bulkOperation === 'copy') {
          after = row.matrix[bulkSourceListId]?.price ?? null
        } else if (current && numeric !== null) {
          after =
            bulkOperation === 'percentIncrease'
              ? Math.round(current.price * (1 + numeric / 100) * 100) / 100
              : Math.round(current.price * (1 - numeric / 100) * 100) / 100
        }

        if (after === null || after < 0) continue
        preview.push({
          itemId: row.id,
          itemLabel,
          listId: list.id,
          listCode: list.code,
          before: current?.price ?? null,
          after,
        })
      }
    }

    return preview
  }, [activeLists, bulkOpen, bulkOperation, bulkSourceListId, bulkValue, selectedRows])

  const handleBulkApply = useCallback(async () => {
    if (!tenantId || !canManage || bulkPreview.length === 0) return
    setBulkBusy(true)
    try {
      const groups = new Map<string, PreviewRow[]>()
      for (const row of bulkPreview) {
        groups.set(row.listId, [...(groups.get(row.listId) ?? []), row])
      }

      let saved = 0
      const failures: string[] = []

      for (const [listId, entries] of groups) {
        const toCreate: PreviewRow[] = []
        for (const entry of entries) {
          const cell = matrix.get(entry.itemId)?.[listId]
          if (cell && cell.validFrom === validFrom) {
            try {
              await updateProductPrice(tenantId, cell.priceId, {
                price: entry.after,
                validFrom,
                validTo: null,
                reason: 'Actualización masiva desde matriz de precios',
                isActive: true,
                tiers: [],
              })
              saved++
            } catch (err: unknown) {
              failures.push(readApiError(err, `No se pudo actualizar ${entry.itemLabel}.`))
            }
          } else {
            toCreate.push(entry)
          }
        }

        if (toCreate.length > 0) {
          try {
            const result = await bulkCreateProductPrices(tenantId, {
              priceListId: listId,
              validFrom,
              validTo: null,
              reason: 'Actualización masiva desde matriz de precios',
              items: toCreate.map((entry) => ({
                catalogItemId: entry.itemId,
                price: entry.after,
              })),
            })
            saved += result.createdCount
          } catch (err: unknown) {
            failures.push(readApiError(err, 'No se pudo aplicar una de las listas.'))
          }
        }
      }

      setBulkOpen(false)
      await load({ silent: true })
      if (failures.length === 0) {
        toast.show({
          title: 'Cambios aplicados',
          message: `${saved} precios actualizados en ${groups.size} lista(s).`,
          variant: 'success',
        })
      } else {
        toast.show({
          title: 'Cambios parciales',
          message: `${saved} guardados · ${failures.length} con error. ${failures[0]}`,
          variant: 'warning',
        })
      }
    } finally {
      setBulkBusy(false)
    }
  }, [bulkPreview, canManage, load, matrix, tenantId, toast, validFrom])

  const handleExportCsv = useCallback(() => {
    const header = ['SKU', 'Producto', ...activeLists.map((list) => list.code)]
    const lines = visibleRows.map((row) => [
      row.sku ?? '',
      row.description?.trim() || row.name,
      ...activeLists.map((list) => {
        const cell = row.matrix[list.id]
        return cell ? cell.price.toFixed(2) : ''
      }),
    ])
    const csv = [header, ...lines].map((line) => line.map((v) => escapeCsv(String(v))).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `matriz-precios-${validFrom}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [activeLists, validFrom, visibleRows])

  const columns = useMemo((): ColumnDef<MatrixRow>[] => {
    const base: ColumnDef<MatrixRow>[] = [
      {
        key: 'name',
        header: 'Producto',
        width: 320,
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '0.85rem' }}>{row.description?.trim() || row.name}</strong>
            <span className="app-shell__muted" style={{ fontSize: '0.75rem' }}>
              {row.sku ?? 'Sin SKU'}
            </span>
          </div>
        ),
      },
    ]

    for (const list of activeLists) {
      base.push({
        key: `list-${list.id}` as unknown as keyof MatrixRow,
        header: (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong>{list.code}</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted)', fontWeight: 400 }}>
              {list.name}
            </span>
          </div>
        ) as unknown as string,
        width: 150,
        align: 'right',
        renderCell: (_value: unknown, row: MatrixRow) => (
          <MatrixPriceCell
            cell={row.matrix[list.id]}
            busy={busyCells.has(`${row.id}:${list.id}`)}
            editable={canManage}
            onCommit={(raw) => void saveCell(row, list, raw)}
          />
        ),
      })
    }

    return base
  }, [activeLists, busyCells, canManage, saveCell])

  if (!canRead) {
    return (
      <TenantSessionGate title="Matriz de precios" lead="Precios por lista en una sola vista">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader title="Matriz de precios" subtitle="Requiere permiso de lectura de precios." />
          <SectionCard title="Acceso Restringido">
            <EmptyState
              icon="lock"
              title="Acceso Restringido"
              description="Necesitas el permiso catalog.pricing.read para ver la matriz de precios."
            />
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Matriz de precios" lead="Precios por lista en una sola vista">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Matriz de precios"
          badge={<StatusBadge tone="primary">Listas × Productos</StatusBadge>}
          subtitle="Edita el precio vigente de cada producto por lista en línea. Al guardar se cierra la vigencia anterior y queda historial."
        />

        <SectionCard title="Cobertura por lista">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {coverage.length === 0 ? (
              <span className="app-shell__muted">Sin listas activas.</span>
            ) : (
              coverage.map(({ list, withPrice, total }) => {
                const today = todayIso()
                const vigencia = !list.isActive
                  ? { tone: 'neutral' as const, label: 'Inactiva' }
                  : list.validTo && list.validTo < today
                    ? { tone: 'danger' as const, label: 'Vencida' }
                      : list.validTo && (new Date(`${list.validTo}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000 <= 7
                        ? { tone: 'warning' as const, label: 'Por vencer' }
                        : { tone: 'success' as const, label: 'Vigente' }
                return (
                  <span key={list.id} className="ecu-chip" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                    {list.code}: {withPrice}/{total}
                    <StatusBadge tone={vigencia.tone}>{vigencia.label}</StatusBadge>
                  </span>
                )
              })
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Productos y listas"
          action={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <DateBox
                id="matrix-valid-from"
                label="Vigente desde"
                labelPosition="outlined"
                variant="outline"
                value={validFrom}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setValidFrom(e.target.value)}
                disabled={loading}
                size="sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                iconLeft={<Layers size={14} />}
                disabled={selectedIds.length === 0 || !canManage}
                onClick={() => {
                  setBulkValue('')
                  setBulkSourceListId(activeLists[0]?.id ?? '')
                  setBulkOpen(true)
                }}
              >
                Aplicar a {selectedIds.length || 0} seleccionados
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                iconLeft={<Download size={14} />}
                onClick={handleExportCsv}
              >
                Exportar CSV
              </Button>
              <GridToolbarRefresh loading={loading} onRefresh={() => void load({ silent: true })} />
            </div>
          }
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <CheckButton
              variant="ghost"
              checked={onlyMissing}
              onChange={setOnlyMissing}
              disabled={loading}
            >
              Solo productos con listas sin precio
            </CheckButton>
            <span className="app-shell__muted" style={{ fontSize: '0.8rem' }}>
              Haz clic en una celda para editar el precio; Enter o salir guarda. Si tienes varios seleccionados, se aplica a todos.
            </span>
          </div>

          {selectedIds.length > 0 && canManage ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                backgroundColor: 'var(--shell-surface-subtle, rgba(37, 99, 235, 0.12))',
                border: '1px solid var(--shell-border, rgba(59, 130, 246, 0.3))',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <StatusBadge tone="primary">
                  {selectedIds.length} producto{selectedIds.length === 1 ? '' : 's'} seleccionado{selectedIds.length === 1 ? '' : 's'}
                </StatusBadge>
                <span style={{ fontSize: '0.85rem', color: 'var(--glb-text, inherit)' }}>
                  Asignar mismo precio a todos:
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ width: 170 }}>
                  <Select
                    id="quick-bulk-list"
                    size="sm"
                    variant="outline"
                    options={[
                      { value: '__all__', label: 'Todas las listas' },
                      ...activeLists.map((l) => ({ value: l.id, label: l.code })),
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
                    placeholder="0.00"
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
                  variant="ghost"
                  size="sm"
                  disabled={quickBusy}
                  onClick={() => setSelectedIds([])}
                >
                  Deseleccionar
                </Button>
              </div>
            </div>
          ) : null}

          {visibleRows.length === 0 && !loading ? (
            <EmptyState
              icon="sell"
              title="Sin productos para mostrar"
              description="Ajusta el filtro o crea productos con variantes para asignarles precios."
            />
          ) : (
            <DataGrid<MatrixRow>
              className="ecu-companies-grid"
              dataSource={visibleRows}
              keyExpr="id"
              columns={columns}
              selectionMode="multiple"
              selectedRowIds={selectedIds}
              onSelectionChange={(selected) => setSelectedIds(selected.map((row) => row.id))}
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar por SKU, nombre o descripción…"
              searchKeys={['sku', 'name', 'description']}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              layout="auto"
              loading={loading}
              messages={gridMessages}
            />
          )}
        </SectionCard>
      </div>

      <Popup
        open={bulkOpen}
        title={`Aplicar cambios a ${selectedRows.length} producto(s)`}
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
        <div className="ecu-companies-form__grid ecu-companies-form__grid--3" style={{ marginBottom: '1rem' }}>
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
              Se aplica a las {activeLists.length} listas activas de los productos seleccionados. Las
              celdas sin precio se omiten en porcentajes y se crean con precio fijo o copia.
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
    </TenantSessionGate>
  )
}

function MatrixPriceCell({
  cell,
  busy,
  editable,
  onCommit,
}: {
  readonly cell: MatrixCell | undefined
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
        }}
      >
        {cell ? `$${cell.price.toFixed(2)}` : '+ Agregar'}
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
