import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, DataGrid, OptionGroup, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import { Calculator, CheckSquare, Layers, List, Pencil, Table2, Trash2, X } from 'lucide-react'
import {
  EmptyState,
  GridIconButton,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import {
  calculateMarginPercent,
  formatMoney,
  isVigentOn,
  todayIso,
  volumeSchemeTypeLabel,
} from '@/pages/catalog/pricing/pricingFormat'
import { ProductPricesMatrixSection } from '@/pages/catalog/pricing/ProductPricesMatrixSection'
import { listCatalogItems } from '@/services/catalogApi'
import {
  assignVolumeDiscountScheme,
  deleteProductPrice,
  listPriceLists,
  listProductPrices,
  listVolumeDiscountSchemes,
} from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CatalogItemListItemDto } from '@/types/catalogApi'
import type {
  PriceListDto,
  ProductPriceListItemDto,
  VolumeDiscountSchemeDto,
} from '@/types/pricingApi'

type ProductPriceRow = ProductPriceListItemDto & {
  templateName?: string | null
} & Record<string, unknown>

type PricingViewMode = 'matrix' | 'records'

const gridMessages = createSpanishDataGridMessages('precio', 'precios')

export function ProductPricesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('catalog.pricing.read')
  const canCreate = useHasPermission('catalog.pricing.create')
  const canEdit = useHasPermission('catalog.pricing.update')
  const canDelete = useHasPermission('catalog.pricing.delete')

  const [viewMode, setViewMode] = useState<PricingViewMode>(() =>
    searchParams.get('priceListId') || searchParams.get('tab') === 'records' ? 'records' : 'matrix'
  )

  const [rows, setRows] = useState<ProductPriceListItemDto[]>([])
  const [lists, setLists] = useState<PriceListDto[]>([])
  const [schemes, setSchemes] = useState<VolumeDiscountSchemeDto[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros y pestañas (vista Registros y vigencias)
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('priceListId') ?? '__all__')
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState(() => searchParams.get('priceListId') ?? '')
  const [templateFilter, setTemplateFilter] = useState('')
  const [schemeFilter, setSchemeFilter] = useState('')
  const [vigencyFilter, setVigencyFilter] = useState('vigent')

  // Selección múltiple para asignación en lote
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [targetSchemeId, setTargetSchemeId] = useState<string>('')
  const [assigningBulk, setAssigningBulk] = useState(false)

  // Confirmar desactivación individual
  const [confirm, setConfirm] = useState<ProductPriceListItemDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const size = useGluComponentSize()

  const handleViewModeChange = useCallback(
    (next: PricingViewMode) => {
      setViewMode(next)
      setSelectedIds([])
      const nextParams = new URLSearchParams(searchParams)
      if (next === 'records') {
        nextParams.set('tab', 'records')
      } else {
        nextParams.delete('tab')
        nextParams.delete('priceListId')
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId)
    setSelectedIds([])
    setListFilter(tabId === '__all__' ? '' : tabId)
  }, [])

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await listProductPrices(tenantId, {
        search: search.trim() || undefined,
        priceListId: listFilter || undefined,
        onlyVigent: vigencyFilter === 'vigent',
      })
      setRows(data)
      setError(null)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudieron cargar los precios.')
      setError(message)
      setRows([])
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [listFilter, search, tenantId, toast, vigencyFilter])

  // Carga inicial de catálogos y esquemas (solo cuando la vista de registros está activa)
  useEffect(() => {
    if (!tenantId || !canRead || viewMode !== 'records') return
    void listPriceLists(tenantId, false).then(setLists).catch(() => setLists([]))
    void listVolumeDiscountSchemes(tenantId, true).then(setSchemes).catch(() => setSchemes([]))
    void listCatalogItems(tenantId).then(setCatalogItems).catch(() => setCatalogItems([]))
  }, [canRead, tenantId, viewMode])

  useEffect(() => {
    if (!canRead || viewMode !== 'records') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [canRead, load, viewMode])

  // Mapa de ítems del catálogo para conocer la plantilla / familia de cada producto
  const catalogItemMap = useMemo(() => {
    const map = new Map<string, CatalogItemListItemDto>()
    for (const item of catalogItems) {
      map.set(item.id, item)
    }
    return map
  }, [catalogItems])

  // Lista única de plantillas / familias
  const availableTemplates = useMemo(() => {
    const names = new Set<string>()
    for (const item of catalogItems) {
      if (item.familyName) names.add(item.familyName)
    }
    return Array.from(names).sort()
  }, [catalogItems])

  // Filas enriquecidas con plantilla y filtradas por plantilla y esquema
  const displayRows = useMemo(() => {
    return rows
      .map((row) => {
        const item = catalogItemMap.get(row.catalogItemId)
        return {
          ...row,
          templateName: item?.familyName ?? null,
        } as ProductPriceRow
      })
      .filter((row) => {
        if (templateFilter && row.templateName !== templateFilter) {
          return false
        }
        if (schemeFilter) {
          if (schemeFilter === 'with_scheme' && !row.volumeDiscountSchemeId) return false
          if (schemeFilter === 'no_scheme' && row.volumeDiscountSchemeId) return false
          if (schemeFilter !== 'with_scheme' && schemeFilter !== 'no_scheme' && row.volumeDiscountSchemeId !== schemeFilter) {
            return false
          }
        }
        return true
      })
  }, [catalogItemMap, rows, schemeFilter, templateFilter])

  const today = todayIso()
  const vigentCount = useMemo(
    () => rows.filter((r) => r.isActive && isVigentOn(r.validFrom, r.validTo, today)).length,
    [rows, today]
  )
  const listFilterOptions = useMemo(
    () => [
      { value: '__all__', label: `Todas (${rows.length})` },
      ...lists.map((l) => ({
        value: l.id,
        label: `${l.code} (${rows.filter((r) => r.priceListId === l.id).length})`,
      })),
    ],
    [lists, rows]
  )
  const uniqueProductCount = useMemo(() => new Set(rows.map((r) => r.catalogItemId)).size, [rows])
  const listCount = useMemo(() => new Set(rows.map((r) => r.priceListId)).size, [rows])
  const withSchemeCount = useMemo(
    () => rows.filter((r) => Boolean(r.volumeDiscountSchemeId)).length,
    [rows]
  )

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirm) return
    setDeleting(true)
    try {
      await deleteProductPrice(tenantId, confirm.id)
      toast.show({
        title: 'Precio desactivado',
        message: `Se desactivó el precio de «${confirm.itemName}» en ${confirm.priceListCode}.`,
        variant: 'success',
      })
      setConfirm(null)
      await load()
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo desactivar',
        message: readApiError(err, 'Intenta nuevamente.'),
        variant: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }, [confirm, load, tenantId, toast])

  // Asignar esquema de volumen en lote a los ítems seleccionados
  const handleBulkAssignScheme = useCallback(async () => {
    if (!tenantId || selectedIds.length === 0) return

    setAssigningBulk(true)
    try {
      const byPriceList = new Map<string, string[]>()
      const selectedRows = displayRows.filter((r) => selectedIds.includes(r.id))
      for (const row of selectedRows) {
        const list = byPriceList.get(row.priceListId) ?? []
        list.push(row.catalogItemId)
        byPriceList.set(row.priceListId, list)
      }

      let totalAssigned = 0
      for (const [pListId, itemIds] of byPriceList.entries()) {
        const result = await assignVolumeDiscountScheme(tenantId, {
          priceListId: pListId,
          volumeDiscountSchemeId: targetSchemeId ? targetSchemeId : null,
          catalogItemIds: itemIds,
        })
        totalAssigned += result.assignedCount
      }

      const schemeObj = schemes.find((s) => s.id === targetSchemeId)
      toast.show({
        title: targetSchemeId ? 'Escala asignada' : 'Escala removida',
        message: targetSchemeId
          ? `Se asignó «${schemeObj?.name ?? 'escala'}» a ${totalAssigned} producto(s).`
          : `Se removió la escala de volumen a ${totalAssigned} producto(s).`,
        variant: 'success',
      })

      setSelectedIds([])
      await load()
    } catch (err: unknown) {
      toast.show({
        title: 'Error al asignar escala',
        message: readApiError(err, 'Intenta nuevamente.'),
        variant: 'error',
      })
    } finally {
      setAssigningBulk(false)
    }
  }, [displayRows, load, schemes, selectedIds, targetSchemeId, tenantId, toast])

  const columns = useMemo((): ColumnDef<ProductPriceRow>[] => {
    const cols: ColumnDef<ProductPriceRow>[] = [
      {
        key: 'sku',
        header: 'SKU',
        width: 140,
        sortable: true,
        renderCell: (_value, row) =>
          row.sku ? (
            <code className="ecu-code">{row.sku}</code>
          ) : (
            <span className="app-shell__muted">—</span>
          ),
      },
      {
        key: 'itemName',
        header: 'Producto',
        width: 240,
        sortable: true,
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong>{row.itemName}</strong>
            {row.templateName ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted, #64748b)',
                  background: 'var(--color-surface-subtle, #f1f5f9)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  width: 'fit-content',
                }}
              >
                {row.templateName}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'priceListCode',
        header: 'Lista',
        width: 130,
        sortable: true,
        renderCell: (_value, row) => <span className="ecu-chip">{row.priceListCode}</span>,
      },
      {
        key: 'price',
        header: 'Precio Lista',
        width: 120,
        align: 'right',
        sortable: true,
        renderCell: (_value, row) => <span className="ecu-price">{formatMoney(row.price)}</span>,
      },
      {
        key: 'averageCost',
        header: 'Margen',
        width: 130,
        align: 'right',
        sortable: true,
        renderCell: (_value, row) => {
          const margin = calculateMarginPercent(row.price, row.averageCost)
          if (margin === null) {
            return (
              <span className="app-shell__muted" style={{ fontSize: '0.8125rem' }}>
                Sin costo
              </span>
            )
          }
          const isBelowCost = margin < 0
          const isLow = margin >= 0 && margin < 10
          return (
            <span
              title={`Costo promedio: ${formatMoney(row.averageCost)}`}
              style={{
                fontWeight: 600,
                color: isBelowCost
                  ? 'var(--color-danger, #ef4444)'
                  : isLow
                    ? 'var(--color-warning, #f59e0b)'
                    : 'var(--color-success, #16a34a)',
              }}
            >
              {isBelowCost ? '⚠ ' : ''}
              {margin.toFixed(1)}%
            </span>
          )
        },
      },
      {
        key: 'volumeDiscountSchemeName',
        header: 'Escala Volumen',
        width: 190,
        sortable: true,
        renderCell: (_value, row) =>
          row.volumeDiscountSchemeName ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(16, 185, 129, 0.16)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              <Layers size={13} />
              {row.volumeDiscountSchemeName}
            </span>
          ) : (
            <span className="app-shell__muted" style={{ fontSize: '0.8125rem' }}>
              —
            </span>
          ),
      },
      {
        key: 'validFrom',
        header: 'Desde',
        width: 105,
        sortable: true,
        renderCell: (_value, row) => formatDate(row.validFrom),
      },
      {
        key: 'validTo',
        header: 'Hasta',
        width: 105,
        sortable: true,
        renderCell: (_value, row) => (row.validTo ? formatDate(row.validTo) : '—'),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 105,
        sortable: true,
        renderCell: (_value, row) => (
          <span className={`ecu-status ${row.isActive ? 'ecu-status--active' : 'ecu-status--inactive'}`}>
            <span className="ecu-status__dot" aria-hidden />
            {row.isActive ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
    ]

    if (canEdit || canDelete) {
      cols.push({
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 105,
        align: 'center',
        sortable: false,
        renderCell: (_value, row) => (
          <div className="ecu-companies-grid__actions">
            {canEdit ? (
              <GridIconButton
                label="Editar precio"
                icon={Pencil}
                onClick={() => navigate(`/catalogo/precios/productos/${row.id}`)}
              />
            ) : null}
            {canDelete ? (
              <GridIconButton
                label="Desactivar"
                icon={Trash2}
                danger
                disabled={!row.isActive || deleting}
                onClick={() => setConfirm(row)}
              />
            ) : null}
          </div>
        ),
      })
    }

    return cols
  }, [canDelete, canEdit, deleting, navigate])

  const columnOrder = useMemo(() => columns.map((c) => c.key), [columns])

  if (!canRead) {
    return (
      <TenantSessionGate title="Precios de productos" lead="Precios vigentes por lista y producto.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.pricing.read para ver los precios de productos."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Precios de productos" lead="Precios vigentes por lista y producto.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Precios de Productos"
          info="Edita precios y costos en línea desde la Matriz o consulta el detalle de vigencias, históricos y registros por lista."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                iconLeft={<Layers size={16} />}
                onClick={() => navigate('/catalogo/precios/escalas-volumen')}
              >
                Escalas por cantidad
              </Button>
              <Button
                variant="outline"
                iconLeft={<Calculator size={16} />}
                onClick={() => navigate('/catalogo/precios/simulador')}
              >
                Simulador
              </Button>
            </div>
          }
        />

        <div
          role="tablist"
          aria-label="Modo de visualización de precios"
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
            paddingBottom: '0.65rem',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'matrix'}
            onClick={() => handleViewModeChange('matrix')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 0.95rem',
              borderRadius: '6px',
              border:
                viewMode === 'matrix'
                  ? '1px solid var(--glb-primary, #3b82f6)'
                  : '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
              backgroundColor: viewMode === 'matrix' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: viewMode === 'matrix' ? 'var(--glb-primary, #60a5fa)' : 'var(--glb-text, inherit)',
              fontWeight: viewMode === 'matrix' ? 600 : 400,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <Table2 size={15} />
            <span>Matriz (edición rápida)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'records'}
            onClick={() => handleViewModeChange('records')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 0.95rem',
              borderRadius: '6px',
              border:
                viewMode === 'records'
                  ? '1px solid var(--glb-primary, #3b82f6)'
                  : '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
              backgroundColor: viewMode === 'records' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: viewMode === 'records' ? 'var(--glb-primary, #60a5fa)' : 'var(--glb-text, inherit)',
              fontWeight: viewMode === 'records' ? 600 : 400,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <List size={15} />
            <span>Registros y vigencias</span>
          </button>
        </div>

        {viewMode === 'matrix' && tenantId ? (
          <ProductPricesMatrixSection tenantId={tenantId} canManage={canCreate || canEdit} />
        ) : (
          <>
        <div className="ecu-stat-grid" aria-label="Resumen de precios">
          <StatCard label="Productos" value={uniqueProductCount} />
          <StatCard label="Vigencias activas" value={vigentCount} />
          <StatCard label="Precios con escala" value={withSchemeCount} />
          <StatCard label="Listas comerciales" value={listCount} />
        </div>

        {/* Barra de acción en lote flotante/destacada cuando hay selección */}
        {selectedIds.length > 0 && canEdit ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              backgroundColor: 'var(--shell-surface-subtle, rgba(37, 99, 235, 0.12))',
              border: '1px solid var(--shell-border, rgba(59, 130, 246, 0.3))',
              borderRadius: '8px',
              padding: '0.75rem 1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckSquare size={20} color="#3b82f6" />
              <div>
                <strong style={{ color: 'var(--glb-text, var(--shell-text, inherit))', fontSize: '0.9375rem' }}>
                  {selectedIds.length} precio(s) seleccionado(s)
                </strong>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--glb-muted, var(--shell-muted, #93c5fd))' }}>
                  Asigna o cambia la escala de descuento por volumen en las filas seleccionadas.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 260 }}>
                <Select
                  id="bulk-target-scheme"
                  aria-label="Seleccionar escala de volumen"
                  variant="outline"
                  options={[
                    { value: '', label: '— Quitar escala (Sin volumen) —' },
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
                variant="primary"
                disabled={assigningBulk}
                onClick={() => void handleBulkAssignScheme()}
              >
                {assigningBulk ? 'Aplicando...' : 'Aplicar a seleccionados'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={<X size={14} />}
                onClick={() => setSelectedIds([])}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        <SectionCard
          title="Precios registrados"
          action={
            <OptionGroup
              id="pp-list-filter"
              name="pp-list-filter"
              options={listFilterOptions}
              value={activeTab}
              onChange={(value: string) => handleTabChange(value)}
              layout="segmented"
              variant="outline"
              size={size}
            />
          }
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && rows.length === 0 && !search.trim() && !templateFilter && !schemeFilter && !listFilter && !error ? (
            <EmptyState
              icon="tag"
              title="No hay precios registrados"
              description="Registra tu primer precio o realiza una carga masiva para empezar."
              action={
                canCreate ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate('/catalogo/precios/productos/nuevo')}
                    >
                      + Nuevo Precio
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/catalogo/precios/productos/masivo')}
                    >
                      Carga masiva
                    </Button>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <DataGrid<ProductPriceRow>
              className="ecu-companies-grid ecu-grid--centered-headers"
              dataSource={displayRows}
              keyExpr="id"
              columns={columns}
              columnOrder={columnOrder}
              selectionMode={canEdit ? 'multiple' : 'none'}
              selectedRowIds={selectedIds}
              onSelectionChange={(selected) => setSelectedIds(selected.map((r) => r.id))}
              showSearch={false}
              toolbarLeft={
                <div style={{ minWidth: 260, maxWidth: 360, width: '100%' }}>
                  <TextBox
                    id="pp-search-tab"
                    aria-label="Buscar producto o SKU"
                    size="sm"
                    variant="outline"
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    placeholder="Buscar producto o SKU…"
                    fullWidth
                  />
                </div>
              }
              toolbarRight={
                <div className="ecu-grid-toolbar-actions" style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {availableTemplates.length > 0 ? (
                    <div style={{ minWidth: 165 }}>
                      <Select
                        id="pp-template-filter-tab"
                        aria-label="Filtrar por familia o plantilla"
                        size="sm"
                        variant="outline"
                        options={[
                          { value: '', label: 'Todas las familias' },
                          ...availableTemplates.map((t) => ({ value: t, label: t })),
                        ]}
                        value={templateFilter}
                        onChange={(value) => setTemplateFilter(String(value))}
                      />
                    </div>
                  ) : null}

                  <div style={{ minWidth: 180 }}>
                    <Select
                      id="pp-scheme-filter-tab"
                      aria-label="Filtrar por escala"
                      size="sm"
                      variant="outline"
                      options={[
                        { value: '', label: 'Todas las escalas' },
                        { value: 'with_scheme', label: 'Con escala de volumen' },
                        { value: 'no_scheme', label: 'Sin escala (estándar)' },
                        ...schemes.map((s) => ({ value: s.id, label: s.name })),
                      ]}
                      value={schemeFilter}
                      onChange={(value) => setSchemeFilter(String(value))}
                    />
                  </div>

                  <div style={{ minWidth: 125 }}>
                    <Select
                      id="pp-vigency-filter-tab"
                      aria-label="Filtrar por vigencia"
                      size="sm"
                      variant="outline"
                      options={[
                        { value: 'vigent', label: 'Vigentes' },
                        { value: 'all', label: 'Todas' },
                      ]}
                      value={vigencyFilter}
                      onChange={(value) => setVigencyFilter(String(value))}
                    />
                  </div>

                  <GridToolbarRefresh size="md" loading={loading} onRefresh={() => void load()} />

                  {canCreate ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/catalogo/precios/productos/masivo')}
                      >
                        Carga por lote
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => navigate('/catalogo/precios/productos/nuevo')}
                      >
                        + Nuevo Precio
                      </Button>
                    </>
                  ) : null}
                </div>
              }
              paging={paging}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              pageSizeOptions={pageSizeOptions}
              layout="auto"
              loading={loading}
              messages={gridMessages}
            />
          )}
        </SectionCard>
          </>
        )}
      </div>

      <Popup
        open={confirm !== null}
        title="Desactivar precio"
        onClose={() => setConfirm(null)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirm(null),
            disabled: deleting,
          },
          {
            id: 'confirm',
            label: 'Sí, desactivar',
            variant: 'primary',
            onClick: () => void handleDelete(),
            disabled: deleting,
          },
        ]}
      >
        {confirm ? (
          <p className="app-shell__muted">
            ¿Desactivar el precio de <strong>{confirm.itemName}</strong> en{' '}
            <strong>{confirm.priceListCode}</strong>? El historial se conserva.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}
