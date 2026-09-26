import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { DataGrid, DateBox, Select, useToast, type ColumnDef } from 'glubox'
import {
  EmptyState,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { endOfDayIso, formatMoney, startOfDayIso } from '@/pages/catalog/pricing/pricingFormat'
import { listCatalogItems } from '@/services/catalogApi'
import { listPriceHistory, listPriceLists } from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { PriceHistoryItemDto, PriceListDto } from '@/types/pricingApi'

type PriceHistoryRow = PriceHistoryItemDto & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('cambio de precio', 'cambios de precio')

export function PriceHistoryPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const canReadHistory = useHasPermission('catalog.pricing.history.read')
  const canReadPricing = useHasPermission('catalog.pricing.read')
  const canRead = canReadHistory || canReadPricing

  const [rows, setRows] = useState<PriceHistoryItemDto[]>([])
  const [items, setItems] = useState<CatalogItemListItemDto[]>([])
  const [lists, setLists] = useState<PriceListDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemId, setItemId] = useState('')
  const [listId, setListId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await listPriceHistory(tenantId, {
        catalogItemId: itemId || undefined,
        priceListId: listId || undefined,
        from: from ? startOfDayIso(from) : undefined,
        to: to ? endOfDayIso(to) : undefined,
      })
      setRows(data)
      setError(null)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo cargar el historial de precios.')
      setError(message)
      setRows([])
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [from, itemId, listId, tenantId, to, toast])

  useEffect(() => {
    if (!tenantId || !canRead) return
    void listCatalogItems(tenantId, { kind: CatalogItemKind.Physical }).then(setItems).catch(() => setItems([]))
    void listPriceLists(tenantId, false).then(setLists).catch(() => setLists([]))
  }, [canRead, tenantId])

  useEffect(() => {
    if (!canRead) return
    void load()
  }, [canRead, load])

  const distinctItems = useMemo(() => new Set(rows.map((r) => r.catalogItemId)).size, [rows])

  const columns = useMemo((): ColumnDef<PriceHistoryRow>[] => {
    return [
      {
        key: 'changedAt',
        header: 'Fecha',
        width: 150,
        sortable: true,
        renderCell: (_value, row) => formatDateTime(row.changedAt),
      },
      {
        key: 'itemName',
        header: 'Producto',
        width: 230,
        sortable: true,
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong>{row.itemName}</strong>
            {row.sku ? <code className="ecu-code">{row.sku}</code> : null}
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
        key: 'previousPrice',
        header: 'Precio anterior',
        width: 140,
        align: 'right',
        sortable: true,
        renderCell: (_value, row) => formatMoney(row.previousPrice),
      },
      {
        key: 'newPrice',
        header: 'Precio nuevo',
        width: 140,
        align: 'right',
        sortable: true,
        renderCell: (_value, row) => formatMoney(row.newPrice),
      },
      {
        key: 'validFrom',
        header: 'Vigencia',
        width: 190,
        sortable: true,
        renderCell: (_value, row) =>
          `${row.validFrom} → ${row.validTo ?? 'indefinida'}`,
      },
      {
        key: 'reason',
        header: 'Motivo',
        width: 220,
        sortable: false,
        renderCell: (_value, row) => row.reason ?? '—',
      },
    ]
  }, [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Historial de precios" lead="Bitácora de cambios de precio.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.pricing.history.read para ver el historial."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Historial de precios" lead="Bitácora de cambios de precio.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Historial de Precios"
          subtitle="Bitácora inmutable: quién cambió, cuándo, precio anterior, precio nuevo, lista y vigencia."
        />

        <div className="ecu-stat-grid" aria-label="Resumen del historial">
          <StatCard label="Cambios" value={rows.length} />
          <StatCard label="Productos" value={distinctItems} />
          <StatCard label="Listas" value={lists.length} />
        </div>

        <SectionCard title="Cambios registrados">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && rows.length === 0 && !error ? (
            <EmptyState
              icon="history"
              title="Sin cambios registrados"
              description="Los cambios de precio aparecerán aquí automáticamente."
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={rows as PriceHistoryRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={240}
              searchPlaceholder="Buscar producto, lista o motivo…"
              searchKeys={['itemName', 'sku', 'priceListCode', 'reason']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <div style={{ minWidth: 220 }}>
                    <Select
                      id="ph-item-filter"
                      aria-label="Filtrar por producto"
                      variant="outline"
                      options={[
                        { value: '', label: 'Todos los productos' },
                        ...items.slice(0, 200).map((item) => ({
                          value: item.id,
                          label: item.sku ? `${item.name} · ${item.sku}` : item.name,
                        })),
                      ]}
                      value={itemId}
                      onChange={(value) => setItemId(String(value))}
                    />
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <Select
                      id="ph-list-filter"
                      aria-label="Filtrar por lista"
                      variant="outline"
                      options={[
                        { value: '', label: 'Todas las listas' },
                        ...lists.map((l) => ({ value: l.id, label: l.code })),
                      ]}
                      value={listId}
                      onChange={(value) => setListId(String(value))}
                    />
                  </div>
                  <div style={{ minWidth: 150 }}>
                    <DateBox
                      id="ph-from"
                      label="Desde"
                      labelPosition="outlined"
                      variant="outline"
                      value={from}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)}
                      fullWidth
                    />
                  </div>
                  <div style={{ minWidth: 150 }}>
                    <DateBox
                      id="ph-to"
                      label="Hasta"
                      labelPosition="outlined"
                      variant="outline"
                      value={to}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setTo(e.target.value)}
                      fullWidth
                    />
                  </div>
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
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
    </TenantSessionGate>
  )
}
