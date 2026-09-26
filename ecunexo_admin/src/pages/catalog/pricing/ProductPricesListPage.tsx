import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import { Pencil, Trash2 } from 'lucide-react'
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
import { formatMoney, isVigentOn, todayIso } from '@/pages/catalog/pricing/pricingFormat'
import { deleteProductPrice, listPriceLists, listProductPrices } from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { PriceListDto, ProductPriceListItemDto } from '@/types/pricingApi'

type ProductPriceRow = ProductPriceListItemDto & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('precio', 'precios')

export function ProductPricesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('catalog.pricing.read')
  const canCreate = useHasPermission('catalog.pricing.create')
  const canEdit = useHasPermission('catalog.pricing.update')
  const canDelete = useHasPermission('catalog.pricing.delete')

  const [rows, setRows] = useState<ProductPriceListItemDto[]>([])
  const [lists, setLists] = useState<PriceListDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState('')
  const [vigencyFilter, setVigencyFilter] = useState('vigent')
  const [confirm, setConfirm] = useState<ProductPriceListItemDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

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

  useEffect(() => {
    if (!tenantId || !canRead) return
    void listPriceLists(tenantId, false).then(setLists).catch(() => setLists([]))
  }, [canRead, tenantId])

  useEffect(() => {
    if (!canRead) return
    void load()
  }, [canRead, load])

  const today = todayIso()
  const vigentCount = useMemo(
    () => rows.filter((r) => r.isActive && isVigentOn(r.validFrom, r.validTo, today)).length,
    [rows, today]
  )
  const listCount = useMemo(() => new Set(rows.map((r) => r.priceListId)).size, [rows])

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
            {row.sku ? <code className="ecu-code">{row.sku}</code> : null}
          </div>
        ),
      },
      {
        key: 'priceListCode',
        header: 'Lista',
        width: 140,
        sortable: true,
        renderCell: (_value, row) => <span className="ecu-chip">{row.priceListCode}</span>,
      },
      {
        key: 'price',
        header: 'Precio',
        width: 120,
        align: 'right',
        sortable: true,
        renderCell: (_value, row) => <span className="ecu-price">{formatMoney(row.price)}</span>,
      },
      {
        key: 'validFrom',
        header: 'Desde',
        width: 110,
        sortable: true,
        renderCell: (_value, row) => formatDate(row.validFrom),
      },
      {
        key: 'validTo',
        header: 'Hasta',
        width: 110,
        sortable: true,
        renderCell: (_value, row) => (row.validTo ? formatDate(row.validTo) : '—'),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 110,
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
        width: 112,
        align: 'center',
        sortable: false,
        renderCell: (_value, row) => (
          <div className="ecu-companies-grid__actions">
            {canEdit ? (
              <GridIconButton
                label="Editar"
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
          subtitle="Precios por lista con vigencia. Cambiar un precio cierra la vigencia anterior y conserva el historial."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de precios">
          <StatCard label="Registros" value={rows.length} />
          <StatCard label="Vigentes" value={vigentCount} />
          <StatCard label="Listas usadas" value={listCount} />
        </div>

        <SectionCard title="Precios registrados">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && rows.length === 0 && !error ? (
            <EmptyState
              icon="tag"
              title="Aún no hay precios registrados"
              description="Crea una vigencia de precio para un producto en una lista comercial."
              action={
                canCreate ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/catalogo/precios/productos/nuevo')}
                  >
                    + Nuevo Precio
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={rows as ProductPriceRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch={false}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <div style={{ minWidth: 200 }}>
                    <TextBox
                      id="pp-search"
                      label="Buscar"
                      labelPosition="outlined"
                      variant="outline"
                      value={search}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                      placeholder="Nombre o SKU…"
                      fullWidth
                    />
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <Select
                      id="pp-list-filter"
                      aria-label="Filtrar por lista"
                      variant="outline"
                      options={[
                        { value: '', label: 'Todas las listas' },
                        ...lists.map((l) => ({ value: l.id, label: l.code })),
                      ]}
                      value={listFilter}
                      onChange={(value) => setListFilter(String(value))}
                    />
                  </div>
                  <div style={{ minWidth: 130 }}>
                    <Select
                      id="pp-vigency-filter"
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
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate('/catalogo/precios/productos/nuevo')}
                    >
                      + Nuevo Precio
                    </Button>
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
