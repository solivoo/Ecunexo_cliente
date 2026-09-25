import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, DataGrid, OptionGroup, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
  GridToolbarRefresh,
} from '@/components/ui'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Eye, PackageCheck } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { isoInstantInRange } from '@/lib/gridLookback'
import { inventoryDocumentStatusLabel, inventoryDocumentTypeLabel } from '@/lib/inventoryLabels'
import { readApiError } from '@/lib/readApiError'
import { listInventoryDocuments, receiveInventoryTransfer } from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  InventoryDocumentStatus,
  InventoryDocumentType,
  type InventoryDocumentListItemDto,
} from '@/types/inventoryApi'

type Row = InventoryDocumentListItemDto & Record<string, unknown>
type DocumentQueue = 'todas' | 'recibir' | 'borradores'

const messages = createSpanishDataGridMessages('documento', 'documentos')

function queueFromSearch(raw: string | null): DocumentQueue {
  if (raw === 'recibir' || raw === 'borradores') return raw
  return 'todas'
}

function isPendingReceipt(row: InventoryDocumentListItemDto): boolean {
  return (
    row.documentType === InventoryDocumentType.Transfer &&
    row.status === InventoryDocumentStatus.InTransit
  )
}

function getDocStatusClass(status: InventoryDocumentStatus) {
  switch (status) {
    case InventoryDocumentStatus.Approved:
      return 'ecu-status--active'
    case InventoryDocumentStatus.InTransit:
      return 'ecu-status--warning'
    case InventoryDocumentStatus.Cancelled:
      return 'ecu-status--danger'
    default:
      return 'ecu-status--inactive'
  }
}

export function InventoryDocumentsListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const size = useGluComponentSize()
  const tenantId = useAppSelector(selectTenantId)
  const canRead =
    useHasPermission('inventory.documents.create') ||
    useHasPermission('inventory.documents.approve') ||
    useHasPermission('inventory.stock.read')
  const canCreate = useHasPermission('inventory.documents.create')
  const canReceive = useHasPermission('inventory.documents.approve')
  const queue = queueFromSearch(params.get('cola'))
  const [rows, setRows] = useState<InventoryDocumentListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const { from, to, setRange, lookback } = useGridDateRange()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listInventoryDocuments(tenantId))
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Documentos sincronizados.', variant: 'success' })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar los documentos.')
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

  const setQueue = useCallback(
    (next: string) => {
      const cola = queueFromSearch(next)
      const nextParams = new URLSearchParams(params)
      if (cola === 'todas') nextParams.delete('cola')
      else nextParams.set('cola', cola)
      setParams(nextParams, { replace: true })
    },
    [params, setParams]
  )

  const pendingReceipts = useMemo(() => rows.filter(isPendingReceipt), [rows])
  const drafts = useMemo(
    () => rows.filter((r) => r.status === InventoryDocumentStatus.Draft),
    [rows]
  )
  const queuedRows = useMemo(() => {
    if (queue === 'recibir') return pendingReceipts
    if (queue === 'borradores') return drafts
    return rows
  }, [drafts, pendingReceipts, queue, rows])
  const visibleRows = useMemo(
    () => queuedRows.filter((r) => isoInstantInRange(r.createdAt, { from, to })),
    [from, queuedRows, to]
  )

  const receiveOne = useCallback(
    async (documentId: string) => {
      if (!tenantId) return
      setBusyId(documentId)
      try {
        await receiveInventoryTransfer(tenantId, documentId)
        toast.show({
          title: 'Recibida',
          message: 'El stock ya está en la bodega destino.',
          variant: 'success',
        })
        await load({ silent: true })
      } catch (err: unknown) {
        toast.show({
          title: 'Error',
          message: readApiError(err, 'No se pudo confirmar la recepción.'),
          variant: 'error',
        })
      } finally {
        setBusyId(null)
      }
    },
    [load, tenantId, toast]
  )

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canCreate) {
      items.push({
        id: 'create-transfer',
        label: 'Nueva transferencia',
        icon: 'plus',
        route: '/inventario/documentos/nuevo?tipo=2',
        disabled: false,
      })
    }
    items.push(
      {
        id: 'stock',
        label: 'Stock',
        icon: 'package',
        route: '/inventario/stock',
        disabled: false,
      },
      {
        id: 'kardex',
        label: 'Kárdex',
        icon: 'receipt',
        route: '/inventario/kardex',
        disabled: false,
      }
    )
    return items
  }, [canCreate])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'documentType',
        header: 'Tipo',
        width: 140,
        sortable: true,
        renderCell: (_v: Row['documentType'], row: Row) => (
          <span className="ecu-chip">{inventoryDocumentTypeLabel(row.documentType)}</span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['status'], row: Row) => (
          <span className={`ecu-status ${getDocStatusClass(row.status)}`}>
            <span className="ecu-status__dot" aria-hidden />
            {inventoryDocumentStatusLabel(row.status)}
          </span>
        ),
      },
      {
        key: 'warehouseName',
        header: 'Ubicación / Ruta',
        width: 240,
        sortable: true,
        renderCell: (_v: Row['warehouseName'], row: Row) =>
          row.destinationWarehouseName ? (
            <span>
              <span className="ecu-chip">{row.warehouseName}</span>{' '}
              <span className="ecu-source" aria-hidden>→</span>{' '}
              <span className="ecu-chip">{row.destinationWarehouseName}</span>
            </span>
          ) : (
            <span className="ecu-chip">{row.warehouseName}</span>
          ),
      },
      {
        key: 'lineCount',
        header: 'Líneas',
        width: 90,
        sortable: true,
        align: 'center',
        renderCell: (_v: Row['lineCount'], row: Row) => <span>{row.lineCount}</span>,
      },
      {
        key: 'createdAt',
        header: 'Emisión',
        width: 120,
        sortable: true,
        renderCell: (_v: Row['createdAt'], row: Row) => formatDate(row.createdAt),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: canReceive ? 104 : 72,
        align: 'center',
        sortable: false,
        renderCell: (_v: Row['id'], row: Row) => (
          <div className="ecu-companies-grid__actions">
            {canReceive && isPendingReceipt(row) ? (
              <GridIconButton
                label="Confirmar recepción"
                icon={PackageCheck}
                disabled={busyId === row.id}
                loading={busyId === row.id}
                onClick={() => void receiveOne(row.id)}
              />
            ) : null}
            <GridIconButton
              label="Abrir detalle"
              icon={Eye}
              onClick={() => navigate(`/inventario/documentos/${row.id}`)}
            />
          </div>
        ),
      },
    ],
    [busyId, canReceive, navigate, receiveOne]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Documentos" lead="Recepciones y egresos logísticos.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de inventario para visualizar los documentos logísticos."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  const receipts = rows.filter((r) => r.documentType === InventoryDocumentType.Receipt).length

  return (
    <TenantSessionGate
      title="Documentos"
      lead="Recepciones, egresos y transferencias entre bodegas. El stock solo se modifica al aprobar o recibir."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Documentos de Inventario"
          subtitle="Comprobantes logísticos de recepción, egreso y transferencia entre bodegas."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de documentos">
          <StatCard label="Documentos" value={rows.length} />
          <StatCard label="Por recibir" value={pendingReceipts.length} />
          <StatCard label="Recepciones" value={receipts} />
          <StatCard label="Borradores" value={drafts.length} />
        </div>

        <SectionCard
          title="Historial"
          action={
            <OptionGroup
              id="inv-docs-queue"
              name="inv-docs-queue"
              options={[
                { value: 'todas', label: 'Todas' },
                {
                  value: 'recibir',
                  label: `Por recibir${pendingReceipts.length ? ` (${pendingReceipts.length})` : ''}`,
                },
                {
                  value: 'borradores',
                  label: `Borradores${drafts.length ? ` (${drafts.length})` : ''}`,
                },
              ]}
              value={queue}
              onChange={setQueue}
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

          {queuedRows.length === 0 && !loading ? (
            <EmptyState
              icon="description"
              title={
                queue === 'recibir'
                  ? 'Sin transferencias por recibir'
                  : queue === 'borradores'
                    ? 'Sin documentos en borrador'
                    : 'Aún no hay documentos registrados'
              }
              description={
                queue === 'recibir'
                  ? 'Cuando despaches una transferencia entre bodegas, aparecerá aquí para confirmar su llegada en destino.'
                  : 'Crea un documento de recepción para ingresar stock inicial o registrar compras a proveedores.'
              }
              action={
                canCreate && queue !== 'recibir' ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/inventario/documentos/nuevo')}
                  >
                    + Nuevo Documento
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={visibleRows as Row[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar bodega o nota…"
              searchKeys={['warehouseName', 'destinationWarehouseName', 'notes']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridDateRangeBox
                    from={from}
                    to={to}
                    lookback={lookback}
                    disabled={loading}
                    onChange={setRange}
                  />
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  {canCreate && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate('/inventario/documentos/nuevo')}
                    >
                      + Nuevo Documento
                    </Button>
                  )}
                  <EcuPageActions
                    items={actionItems}
                    variant="outline"
                    triggerLabel="Acciones de documentos"
                    renderIcon={renderSidebarIcon}
                    onNavigate={(route: string) => navigate(route)}
                  />
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
