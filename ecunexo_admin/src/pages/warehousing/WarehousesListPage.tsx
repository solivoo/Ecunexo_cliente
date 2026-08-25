import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
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
  const canRead = useHasPermission('warehousing.read') || useHasPermission('warehousing.locations.manage')
  const canManage =
    useHasPermission('warehousing.locations.manage') || useHasPermission('warehousing.warehouse.manage')
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
    if (canManage) {
      items.push({
        id: 'create',
        label: 'Nueva bodega',
        icon: 'plus',
        route: '/bodegas/nueva',
        disabled: false,
      })
    }
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
        width: 120,
        sortable: true,
        renderCell: (_v: Row['code'], row: Row) => row.code ?? '—',
      },
      {
        key: 'isMain',
        header: 'Principal',
        width: 110,
        sortable: true,
        renderCell: (_v: Row['isMain'], row: Row) => (row.isMain ? 'Sí' : '—'),
      },
      {
        key: 'isSystem',
        header: 'Sistema',
        width: 140,
        sortable: true,
        renderCell: (_v: Row['isSystem'], row: Row) =>
          row.systemRole === 1 ? 'En tránsito' : row.isSystem ? 'Sí' : '—',
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
        <p className="app-shell__page-lead">Requieres warehousing.read para ver bodegas.</p>
      </TenantSessionGate>
    )
  }

  const mainCount = rows.filter((r) => r.isMain).length
  const transitCount = rows.filter((r) => r.systemRole === 1).length
  const operationalCount = rows.filter((r) => !r.isSystem).length

  return (
    <TenantSessionGate title="Bodegas" lead="Dónde se guarda el stock. La de tránsito es de sistema (ADR-010).">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Si el plan permite más de una bodega, al entrar se crean «Principal» y
            «En tránsito». Con cupo de una, creás vos la única ubicación.
          </p>
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
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de bodegas">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Bodegas</p>
            <p className="ecu-companies-page__metric-value">{rows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Principal</p>
            <p className="ecu-companies-page__metric-value">{mainCount}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">En tránsito</p>
            <p className="ecu-companies-page__metric-value">{transitCount}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Operativas</p>
            <p className="ecu-companies-page__metric-value">{operationalCount}</p>
          </article>
        </div>

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="ecu-companies-page__body">
          {rows.length === 0 && !loading ? (
            <div className="ecu-companies-page__empty">
              <h2 className="app-shell__section-title">Sin bodegas</h2>
              {canManage ? (
                <Button type="button" variant="primary" onClick={() => navigate('/bodegas/nueva')}>
                  Nueva bodega
                </Button>
              ) : null}
            </div>
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
              searchPlaceholder="Buscar bodega…"
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
        </div>
      </div>
    </TenantSessionGate>
  )
}
