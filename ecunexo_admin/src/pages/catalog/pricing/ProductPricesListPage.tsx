import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, DataGrid, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import { Calculator, CheckSquare, Layers, Pencil, Trash2, X } from 'lucide-react'
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
import {
  formatMoney,
  isVigentOn,
  todayIso,
  volumeSchemeTypeLabel,
} from '@/pages/catalog/pricing/pricingFormat'
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

type GroupedProductPriceRow = {
  [key: string]: unknown
  catalogItemId: string
  itemName: string
  sku: string | null
  templateName: string | null
  volumeDiscountSchemeName: string | null
  volumeDiscountSchemeId: string | null
  prices: Record<
    string,
    { id: string; price: number; validFrom: string; validTo: string | null; isActive: boolean } | undefined
  >
}

const gridMessages = createSpanishDataGridMessages('precio', 'precios')

export function ProductPricesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('catalog.pricing.read')
  const canCreate = useHasPermission('catalog.pricing.create')
  const canEdit = useHasPermission('catalog.pricing.update')
  const canDelete = useHasPermission('catalog.pricing.delete')

  const [rows, setRows] = useState<ProductPriceListItemDto[]>([])
  const [lists, setLists] = useState<PriceListDto[]>([])
  const [schemes, setSchemes] = useState<VolumeDiscountSchemeDto[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItemListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros y pestañas
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('priceListId') ?? '__grouped__')
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

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId)
    setSelectedIds([])
    if (tabId === '__grouped__' || tabId === '__all__') {
      setListFilter('')
    } else {
      setListFilter(tabId)
    }
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

  // Carga inicial de catálogos y esquemas
  useEffect(() => {
    if (!tenantId || !canRead) return
    void listPriceLists(tenantId, false).then(setLists).catch(() => setLists([]))
    void listVolumeDiscountSchemes(tenantId, true).then(setSchemes).catch(() => setSchemes([]))
    void listCatalogItems(tenantId).then(setCatalogItems).catch(() => setCatalogItems([]))
  }, [canRead, tenantId])

  useEffect(() => {
    if (!canRead) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [canRead, load])

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
  const uniqueProductCount = useMemo(() => new Set(rows.map((r) => r.catalogItemId)).size, [rows])
  const listCount = useMemo(() => new Set(rows.map((r) => r.priceListId)).size, [rows])
  const withSchemeCount = useMemo(
    () => rows.filter((r) => Boolean(r.volumeDiscountSchemeId)).length,
    [rows]
  )

  const groupedRows = useMemo<GroupedProductPriceRow[]>(() => {
    const map = new Map<string, GroupedProductPriceRow>()
    for (const row of displayRows) {
      let entry = map.get(row.catalogItemId)
      if (!entry) {
        entry = {
          catalogItemId: row.catalogItemId,
          itemName: row.itemName,
          sku: row.sku ?? null,
          templateName: row.templateName ?? null,
          volumeDiscountSchemeName: row.volumeDiscountSchemeName ?? null,
          volumeDiscountSchemeId: row.volumeDiscountSchemeId ?? null,
          prices: {},
        }
        map.set(row.catalogItemId, entry)
      }
      entry.prices[row.priceListId] = {
        id: row.id,
        price: row.price,
        validFrom: row.validFrom,
        validTo: row.validTo,
        isActive: row.isActive,
      }
      if (row.volumeDiscountSchemeName && !entry.volumeDiscountSchemeName) {
        entry.volumeDiscountSchemeName = row.volumeDiscountSchemeName
        entry.volumeDiscountSchemeId = row.volumeDiscountSchemeId ?? null
      }
    }
    return Array.from(map.values())
  }, [displayRows])

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
      if (activeTab === '__grouped__') {
        for (const list of lists.filter((l) => l.isActive)) {
          byPriceList.set(list.id, selectedIds)
        }
      } else {
        const selectedRows = displayRows.filter((r) => selectedIds.includes(r.id))
        for (const row of selectedRows) {
          const list = byPriceList.get(row.priceListId) ?? []
          list.push(row.catalogItemId)
          byPriceList.set(row.priceListId, list)
        }
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
  }, [activeTab, displayRows, lists, load, schemes, selectedIds, targetSchemeId, tenantId, toast])

  const columns = useMemo((): ColumnDef<ProductPriceRow>[] => {
    const cols: ColumnDef<ProductPriceRow>[] = [
      {
        key: 'itemName',
        header: 'Producto',
        width: 240,
        sortable: true,
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong>{row.itemName}</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {row.sku ? <code className="ecu-code">{row.sku}</code> : null}
              {row.templateName ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted, #64748b)',
                    background: 'var(--color-surface-subtle, #f1f5f9)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {row.templateName}
                </span>
              ) : null}
            </div>
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

  const groupedColumns = useMemo((): ColumnDef<GroupedProductPriceRow>[] => {
    const cols: ColumnDef<GroupedProductPriceRow>[] = [
      {
        key: 'itemName',
        header: 'Producto',
        width: 260,
        sortable: true,
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong style={{ fontSize: '0.85rem' }}>{row.itemName}</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {row.sku ? <code className="ecu-code">{row.sku}</code> : null}
              {row.templateName ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--glb-muted, #64748b)',
                    background: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.08))',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {row.templateName}
                </span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        key: 'volumeDiscountSchemeName',
        header: 'Escala Volumen',
        width: 180,
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
    ]

    for (const list of lists.filter((l) => l.isActive)) {
      cols.push({
        key: `price-${list.id}` as unknown as keyof GroupedProductPriceRow,
        header: (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <strong>{list.code}</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted)', fontWeight: 400 }}>
              {list.isDefault ? 'Predeterminada' : list.name}
            </span>
          </div>
        ) as unknown as string,
        width: 140,
        align: 'right',
        renderCell: (_value: unknown, row: GroupedProductPriceRow) => {
          const p = row.prices[list.id]
          if (!p) {
            return (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canCreate}
                onClick={() =>
                  navigate(
                    `/catalogo/precios/productos/nuevo?catalogItemId=${row.catalogItemId}&priceListId=${list.id}`
                  )
                }
              >
                + Fijar
              </Button>
            )
          }
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
              <span className="ecu-price" style={{ fontWeight: 600 }}>
                {formatMoney(p.price)}
              </span>
              {canEdit ? (
                <GridIconButton
                  label={`Editar precio en ${list.code}`}
                  icon={Pencil}
                  onClick={() => navigate(`/catalogo/precios/productos/${p.id}`)}
                />
              ) : null}
            </div>
          )
        },
      } as ColumnDef<GroupedProductPriceRow>)
    }

    cols.push({
      key: 'catalogItemId',
      header: 'Acciones',
      sticky: 'right',
      width: 130,
      align: 'center',
      sortable: false,
      renderCell: (_value: unknown, row: GroupedProductPriceRow) => (
        <div className="ecu-companies-grid__actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCreate}
            onClick={() =>
              navigate(`/catalogo/precios/productos/nuevo?catalogItemId=${row.catalogItemId}`)
            }
          >
            + Nueva vigencia
          </Button>
        </div>
      ),
    })

    return cols
  }, [canCreate, canEdit, lists, navigate])

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
          subtitle="Precios por lista con vigencia y escalas de descuento por cantidad. Puedes seleccionar productos en lote para asignarles una escala de volumen."
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
                iconLeft={<Layers size={16} />}
                onClick={() => navigate('/catalogo/precios/matriz')}
              >
                Vista matriz
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

        <div className="ecu-stat-grid" aria-label="Resumen de precios">
          <StatCard label="Productos" value={uniqueProductCount} />
          <StatCard label="Vigencias activas" value={vigentCount} />
          <StatCard label="Con Escala Volumen" value={withSchemeCount} />
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
                  {selectedIds.length} {activeTab === '__grouped__' ? 'producto(s)' : 'precio(s)'} seleccionado(s)
                </strong>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--glb-muted, var(--shell-muted, #93c5fd))' }}>
                  Asigna o cambia la escala de descuento por volumen a todos los ítems seleccionados.
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

        <SectionCard title="Precios registrados">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {/* Pestañas de Vista y Listas de Precios */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
              paddingBottom: '0.65rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--glb-muted, #94a3b8)', marginRight: '0.25rem' }}>
              Vista:
            </span>

            <button
              type="button"
              onClick={() => handleTabChange('__grouped__')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: activeTab === '__grouped__' ? '1px solid var(--glb-primary, #3b82f6)' : '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                backgroundColor: activeTab === '__grouped__' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: activeTab === '__grouped__' ? 'var(--glb-primary, #60a5fa)' : 'var(--glb-text, inherit)',
                fontWeight: activeTab === '__grouped__' ? 600 : 400,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <span>📊 Columnas por lista</span>
              {groupedRows.length > 0 ? (
                <span style={{ fontSize: '0.75rem', opacity: 0.8, background: 'rgba(125,125,125,0.2)', padding: '1px 6px', borderRadius: '10px' }}>
                  {groupedRows.length} productos
                </span>
              ) : null}
            </button>

            {lists.map((l) => {
              const isSelected = activeTab === l.id
              const count = rows.filter((r) => r.priceListId === l.id).length
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleTabChange(l.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid var(--glb-primary, #3b82f6)' : '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: isSelected ? 'var(--glb-primary, #60a5fa)' : 'var(--glb-text, inherit)',
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>{l.code}</span>
                  {count > 0 ? (
                    <span style={{ fontSize: '0.75rem', opacity: 0.8, background: 'rgba(125,125,125,0.2)', padding: '1px 6px', borderRadius: '10px' }}>
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => handleTabChange('__all__')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: activeTab === '__all__' ? '1px solid var(--glb-primary, #3b82f6)' : '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                backgroundColor: activeTab === '__all__' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: activeTab === '__all__' ? 'var(--glb-primary, #60a5fa)' : 'var(--glb-text, inherit)',
                fontWeight: activeTab === '__all__' ? 600 : 400,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <span>Todos los registros</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.8, background: 'rgba(125,125,125,0.2)', padding: '1px 6px', borderRadius: '10px' }}>
                {rows.length}
              </span>
            </button>
          </div>

          {!loading && ((activeTab === '__grouped__' && groupedRows.length === 0) || (activeTab !== '__grouped__' && displayRows.length === 0)) && !error ? (
            <EmptyState
              icon="tag"
              title="No hay precios coincidentes"
              description="Ajusta los filtros de búsqueda, plantilla o pestaña comercial."
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
          ) : activeTab === '__grouped__' ? (
            <DataGrid<GroupedProductPriceRow>
              className="ecu-companies-grid"
              dataSource={groupedRows}
              keyExpr="catalogItemId"
              columns={groupedColumns}
              selectionMode={canEdit ? 'multiple' : 'none'}
              selectedRowIds={selectedIds}
              onSelectionChange={(selected) => setSelectedIds(selected.map((r) => r.catalogItemId))}
              showSearch={false}
              toolbarLeft={
                <div style={{ minWidth: 260, maxWidth: 360, width: '100%' }}>
                  <TextBox
                    id="pp-search"
                    label="Buscar producto o SKU"
                    labelPosition="outlined"
                    variant="outline"
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    placeholder="Escribe nombre o SKU…"
                    fullWidth
                  />
                </div>
              }
              toolbarRight={
                <div className="ecu-grid-toolbar-actions" style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {availableTemplates.length > 0 ? (
                    <div style={{ minWidth: 165 }}>
                      <Select
                        id="pp-template-filter"
                        label="Plantilla"
                        labelPosition="outlined"
                        aria-label="Filtrar por plantilla"
                        variant="outline"
                        options={[
                          { value: '', label: 'Todas las plantillas' },
                          ...availableTemplates.map((t) => ({ value: t, label: t })),
                        ]}
                        value={templateFilter}
                        onChange={(value) => setTemplateFilter(String(value))}
                      />
                    </div>
                  ) : null}

                  <div style={{ minWidth: 180 }}>
                    <Select
                      id="pp-scheme-filter"
                      label="Escala por cantidad"
                      labelPosition="outlined"
                      aria-label="Filtrar por escala"
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
                      id="pp-vigency-filter"
                      label="Vigencia"
                      labelPosition="outlined"
                      aria-label="Filtrar por vigencia"
                      variant="outline"
                      options={[
                        { value: 'vigent', label: 'Vigentes' },
                        { value: 'all', label: 'Todas' },
                      ]}
                      value={vigencyFilter}
                      onChange={(value) => setVigencyFilter(String(value))}
                    />
                  </div>

                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />

                  {canCreate ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/catalogo/precios/productos/masivo')}
                      >
                        Carga masiva
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
          ) : (
            <DataGrid<ProductPriceRow>
              className="ecu-companies-grid"
              dataSource={displayRows}
              keyExpr="id"
              columns={columns}
              selectionMode={canEdit ? 'multiple' : 'none'}
              selectedRowIds={selectedIds}
              onSelectionChange={(selected) => setSelectedIds(selected.map((r) => r.id))}
              showSearch={false}
              toolbarLeft={
                <div style={{ minWidth: 260, maxWidth: 360, width: '100%' }}>
                  <TextBox
                    id="pp-search-tab"
                    label="Buscar producto o SKU"
                    labelPosition="outlined"
                    variant="outline"
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    placeholder="Escribe nombre o SKU…"
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
                        label="Plantilla"
                        labelPosition="outlined"
                        aria-label="Filtrar por plantilla"
                        variant="outline"
                        options={[
                          { value: '', label: 'Todas las plantillas' },
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
                      label="Escala por cantidad"
                      labelPosition="outlined"
                      aria-label="Filtrar por escala"
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
                      label="Vigencia"
                      labelPosition="outlined"
                      aria-label="Filtrar por vigencia"
                      variant="outline"
                      options={[
                        { value: 'vigent', label: 'Vigentes' },
                        { value: 'all', label: 'Todas' },
                      ]}
                      value={vigencyFilter}
                      onChange={(value) => setVigencyFilter(String(value))}
                    />
                  </div>

                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />

                  {canCreate ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/catalogo/precios/productos/masivo')}
                      >
                        Carga masiva
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
