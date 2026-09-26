import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Popup, useToast, type ColumnDef } from 'glubox'
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
import { deletePriceList, listPriceLists } from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { PriceListDto } from '@/types/pricingApi'

type PriceListRow = PriceListDto & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('lista de precios', 'listas de precios')

export function PriceListsListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('catalog.pricing.read')
  const canCreate = useHasPermission('catalog.pricing.create')
  const canEdit = useHasPermission('catalog.pricing.update')
  const canDelete = useHasPermission('catalog.pricing.delete')
  const [rows, setRows] = useState<PriceListDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<PriceListDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      setRows(await listPriceLists(tenantId, false))
      setError(null)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudieron cargar las listas de precios.')
      setError(message)
      setRows([])
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    if (!canRead) return
    void load()
  }, [canRead, load])

  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])
  const defaultList = useMemo(() => rows.find((r) => r.isDefault && r.isActive), [rows])

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirm) return
    setDeleting(true)
    try {
      await deletePriceList(tenantId, confirm.id)
      toast.show({ title: 'Lista desactivada', message: `«${confirm.name}» quedó inactiva.`, variant: 'success' })
      setConfirm(null)
      await load()
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo desactivar',
        message: readApiError(err, 'La lista tiene precios asociados o es la predeterminada.'),
        variant: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }, [confirm, load, tenantId, toast])

  const columns = useMemo((): ColumnDef<PriceListRow>[] => {
    const cols: ColumnDef<PriceListRow>[] = [
      {
        key: 'code',
        header: 'Código',
        width: 140,
        sortable: true,
        renderCell: (_value, row) => <code className="ecu-code">{row.code}</code>,
      },
      {
        key: 'name',
        header: 'Nombre',
        width: 220,
        sortable: true,
        renderCell: (_value, row) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <strong>{row.name}</strong>
            {row.isDefault ? <StatusBadge tone="primary">Predeterminada</StatusBadge> : null}
          </span>
        ),
      },
      {
        key: 'currency',
        header: 'Moneda',
        width: 90,
        sortable: true,
      },
      {
        key: 'pricesIncludeTax',
        header: 'IVA incluido',
        width: 110,
        sortable: true,
        renderCell: (_value, row) => (row.pricesIncludeTax ? 'Sí' : 'No'),
      },
      {
        key: 'validFrom',
        header: 'Vigencia',
        width: 190,
        sortable: true,
        renderCell: (_value, row) =>
          `${formatDate(row.validFrom)} – ${row.validTo ? formatDate(row.validTo) : 'indefinida'}`,
      },
      {
        key: 'priority',
        header: 'Prioridad',
        width: 90,
        align: 'center',
        sortable: true,
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 110,
        sortable: true,
        renderCell: (_value, row) => (
          <span className={`ecu-status ${row.isActive ? 'ecu-status--active' : 'ecu-status--inactive'}`}>
            <span className="ecu-status__dot" aria-hidden />
            {row.isActive ? 'Activa' : 'Inactiva'}
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
                onClick={() => navigate(`/catalogo/precios/listas/${row.id}`)}
              />
            ) : null}
            {canDelete ? (
              <GridIconButton
                label="Desactivar"
                icon={Trash2}
                danger
                disabled={row.isDefault || !row.isActive || deleting}
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
      <TenantSessionGate title="Listas de precios" lead="Gestión comercial de precios por lista.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.pricing.read para ver las listas de precios."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Listas de precios" lead="Gestión comercial de precios por lista.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Listas de Precios"
          subtitle="Listas comerciales (público, mayorista, distribuidor) con vigencia, prioridad y moneda."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de listas">
          <StatCard label="Listas" value={rows.length} />
          <StatCard label="Activas" value={activeCount} />
          <StatCard label="Predeterminada" value={defaultList?.code ?? '—'} />
        </div>

        <SectionCard title="Listado de listas">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && rows.length === 0 && !error ? (
            <EmptyState
              icon="list"
              title="Aún no hay listas de precios"
              description="Crea una lista pública o mayorista para comenzar a asignar precios."
              action={
                canCreate ? (
                  <Button type="button" variant="primary" onClick={() => navigate('/catalogo/precios/listas/nueva')}>
                    + Nueva Lista
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={rows as PriceListRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={260}
              searchPlaceholder="Buscar código o nombre…"
              searchKeys={['code', 'name', 'description']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  {canCreate ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate('/catalogo/precios/listas/nueva')}
                    >
                      + Nueva Lista
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
        title="Desactivar lista de precios"
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
            ¿Desactivar <strong>{confirm.name}</strong>? Los precios históricos se conservan y la lista
            deja de usarse para nuevas ventas.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}
