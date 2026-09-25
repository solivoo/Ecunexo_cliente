import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, useToast, type ColumnDef } from 'glubox'
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
  GridToolbarRefresh,
} from '@/components/ui'
import { Pencil } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { listWarehouses } from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { WarehouseListItemDto } from '@/types/inventoryApi'

type Row = WarehouseListItemDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('bodega', 'bodegas')

export function WarehousesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canReadWarehousing = useHasPermission('warehousing.read')
  const canManageLocations = useHasPermission('warehousing.locations.manage')
  const canManageWarehouse = useHasPermission('warehousing.warehouse.manage')
  const canRead = canReadWarehousing || canManageLocations
  const canManage = canManageLocations || canManageWarehouse
  const [rows, setRows] = useState<WarehouseListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listWarehouses(tenantId))
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Bodegas sincronizadas.', variant: 'success' })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar las bodegas.')
        setError(message)
        setRows([])
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    if (canRead) void load({ silent: true })
  }, [canRead, load])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'name',
        header: 'Nombre',
        width: 220,
        sortable: true,
        renderCell: (_v: Row['name'], row: Row) => <strong>{row.name}</strong>,
      },
      {
        key: 'code',
        header: 'Código',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['code'], row: Row) =>
          row.code ? <code className="ecu-code">{row.code}</code> : '—',
      },
      {
        key: 'isMain',
        header: 'Principal',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['isMain'], row: Row) => (
          <span
            className={`ecu-status ${row.isMain ? 'ecu-status--active' : 'ecu-status--inactive'}`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {row.isMain ? 'Sí' : 'No'}
          </span>
        ),
      },
      {
        key: 'isSystem',
        header: 'Tipo / Rol',
        width: 140,
        sortable: true,
        renderCell: (_v: Row['isSystem'], row: Row) =>
          row.systemRole === 1 ? (
            <span className="ecu-chip ecu-chip--muted">En tránsito</span>
          ) : row.isSystem ? (
            <span className="ecu-chip">Sistema</span>
          ) : (
            <span className="ecu-chip ecu-chip--accent">Operativa</span>
          ),
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 120,
        sortable: true,
        renderCell: (_v: Row['createdAt'], row: Row) => formatDate(row.createdAt),
      },
      ...(canManage
        ? ([
            {
              key: 'id',
              header: 'Acciones',
              sticky: 'right',
              width: 72,
              align: 'center' as const,
              sortable: false,
              renderCell: (_v: Row['id'], row: Row) =>
                row.isSystem ? (
                  '—'
                ) : (
                  <div className="ecu-companies-grid__actions">
                    <GridIconButton
                      label="Editar"
                      icon={Pencil}
                      onClick={() => navigate(`/bodegas/${row.id}`)}
                    />
                  </div>
                ),
            },
          ] satisfies ColumnDef<Row>[])
        : []),
    ],
    [canManage, navigate]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Bodegas" lead="Ubicaciones de stock.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres warehousing.read para visualizar las bodegas de la empresa."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  const mainCount = rows.filter((r) => r.isMain).length
  const transitCount = rows.filter((r) => r.systemRole === 1).length
  const operationalCount = rows.filter((r) => !r.isSystem).length

  return (
    <TenantSessionGate
      title="Bodegas"
      lead="Ubicaciones de stock físico. Las transferencias usan la bodega de tránsito de sistema."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Bodegas y Almacenes"
          subtitle="Centros logísticos y ubicaciones operativas de almacenamiento."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de bodegas">
          <StatCard label="Bodegas" value={rows.length} />
          <StatCard label="Principal" value={mainCount} />
          <StatCard label="Operativas" value={operationalCount} />
          <StatCard label="En tránsito" value={transitCount} />
        </div>

        <SectionCard title="Ubicaciones">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {rows.length === 0 && !loading ? (
            <EmptyState
              icon="warehouse"
              title="Aún no hay bodegas registradas"
              description="Crea tu primera bodega operativa para comenzar a registrar entradas, salidas y movimientos de inventario."
              action={
                canManage ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/bodegas/nueva')}
                  >
                    + Nueva Bodega
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={rows as Row[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar bodega o código…"
              searchKeys={['name', 'code']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  {canManage && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate('/bodegas/nueva')}
                    >
                      + Nueva Bodega
                    </Button>
                  )}
                </div>
              }
              paging={paging}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              pageSizeOptions={pageSizeOptions}
              layout="auto"
              loading={loading}
              messages={messages}
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
