import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
} from '@/components/ui'
import { Pencil } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
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

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    items.push({
      id: 'refresh',
      label: 'Actualizar',
      icon: 'refresh-cw',
      route: null,
      disabled: loading,
    })
    return items
  }, [canManage, loading])

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
        renderCell: (_v: Row['isMain'], row: Row) =>
          row.isMain ? (
            <StatusBadge tone="success" withDot>
              Principal
            </StatusBadge>
          ) : (
            '—'
          ),
      },
      {
        key: 'isSystem',
        header: 'Tipo / Rol',
        width: 140,
        sortable: true,
        renderCell: (_v: Row['isSystem'], row: Row) =>
          row.systemRole === 1 ? (
            <StatusBadge tone="warning">En tránsito</StatusBadge>
          ) : row.isSystem ? (
            <StatusBadge tone="neutral">Sistema</StatusBadge>
          ) : (
            <StatusBadge tone="info">Operativa</StatusBadge>
          ),
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 170,
        sortable: true,
        renderCell: (_v: Row['createdAt'], row: Row) => formatDateTime(row.createdAt),
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
        <div className="ecu-dashboard-layout">
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
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Bodegas y Almacenes"
          subtitle="Centros logísticos y ubicaciones operativas de almacenamiento. Permite controlar las existencias físicas y transferencias entre sucursales."
          badge={
            <StatusBadge tone="primary" withDot>
              {rows.length} {rows.length === 1 ? 'Bodega' : 'Bodegas'}
            </StatusBadge>
          }
          actions={
            <>
              {canManage && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/bodegas/nueva')}
                >
                  + Nueva Bodega
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de bodegas"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={(item: PageActionItem) => {
                  if (item.id === 'refresh') void load()
                }}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de bodegas">
          <StatCard
            label="Total Bodegas"
            value={rows.length}
            icon="warehouse"
            toneColor="#4f46e5"
            footerText="Ubicaciones en plataforma"
          />
          <StatCard
            label="Bodega Principal"
            value={mainCount}
            icon="home_work"
            toneColor="#10b981"
            footerText="Punto predeterminado"
          />
          <StatCard
            label="Operativas"
            value={operationalCount}
            icon="store"
            toneColor="#0ea5e9"
            footerText="Almacenamiento y despacho"
          />
          <StatCard
            label="En Tránsito"
            value={transitCount}
            icon="local_shipping"
            toneColor="#8b5cf6"
            footerText="Movimientos entre sedes"
          />
        </div>

        <SectionCard
          title="Ubicaciones de Inventario"
          subtitle="Puntos de control físico donde reside el stock de productos"
        >
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
