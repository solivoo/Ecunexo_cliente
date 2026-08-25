import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, DataGrid, OptionGroup, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Eye, PackageCheck } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
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
      items.push({
        id: 'create',
        label: 'Nuevo documento',
        icon: 'file-text',
        route: '/inventario/documentos/nuevo',
        disabled: false,
      })
    }
    items.push({
      id: 'refresh',
      label: 'Actualizar',
      route: null,
      icon: 'refresh-cw',
      disabled: loading,
    })
    return items
  }, [canCreate, loading])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'documentType',
        header: 'Tipo',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['documentType'], row: Row) => (
          <strong>{inventoryDocumentTypeLabel(row.documentType)}</strong>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 120,
        sortable: true,
        renderCell: (_v: Row['status'], row: Row) => inventoryDocumentStatusLabel(row.status),
      },
      {
        key: 'warehouseName',
        header: 'Bodega',
        width: 220,
        sortable: true,
        renderCell: (_v: Row['warehouseName'], row: Row) =>
          row.destinationWarehouseName
            ? `${row.warehouseName} → ${row.destinationWarehouseName}`
            : row.warehouseName,
      },
      {
        key: 'lineCount',
        header: 'Líneas',
        width: 90,
        sortable: true,
        renderCell: (_v: Row['lineCount'], row: Row) => String(row.lineCount),
      },
      {
        key: 'createdAt',
        header: 'Creado',
        width: 170,
        sortable: true,
        renderCell: (_v: Row['createdAt'], row: Row) => formatDateTime(row.createdAt),
      },
      {
        key: 'id',
        header: 'Acciones',
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
              label="Abrir"
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
        <p className="app-shell__page-lead">Requieres permisos de inventario.</p>
      </TenantSessionGate>
    )
  }

  const receipts = rows.filter((r) => r.documentType === InventoryDocumentType.Receipt).length

  return (
    <TenantSessionGate
      title="Documentos"
      lead={
        queue === 'recibir'
          ? 'Cola de transferencias despachadas. Confirma la llegada en destino.'
          : 'Recepción, egreso y transferencia. El stock solo cambia al aprobar o recibir.'
      }
    >
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Despachar saca del origen. Recibir entra al destino. Son dos momentos distintos.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de documentos"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={(item: PageActionItem) => {
              if (item.id === 'refresh') void load()
            }}
          />
        </div>

        <div className="ecu-comprobantes-filters" role="group" aria-label="Cola de documentos">
          <OptionGroup
            id="inv-docs-queue"
            name="inv-docs-queue"
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'recibir', label: `Por recibir${pendingReceipts.length ? ` (${pendingReceipts.length})` : ''}` },
              { value: 'borradores', label: `Borradores${drafts.length ? ` (${drafts.length})` : ''}` },
            ]}
            value={queue}
            onChange={setQueue}
            layout="segmented"
            variant="outline"
            size={size}
          />
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de documentos">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Documentos</p>
            <p className="ecu-companies-page__metric-value">{rows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Por recibir</p>
            <p className="ecu-companies-page__metric-value">{pendingReceipts.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Recepciones</p>
            <p className="ecu-companies-page__metric-value">{receipts}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Borradores</p>
            <p className="ecu-companies-page__metric-value">{drafts.length}</p>
          </article>
        </div>

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="ecu-companies-page__body">
          {queuedRows.length === 0 && !loading ? (
            <div className="ecu-companies-page__empty">
              <h2 className="app-shell__section-title">
                {queue === 'recibir'
                  ? 'Nada por recibir'
                  : queue === 'borradores'
                    ? 'Sin borradores'
                    : 'Sin documentos'}
              </h2>
              {queue === 'recibir' ? (
                <p className="app-shell__muted">
                  Cuando despaches una transferencia, aparece aquí para confirmarla en destino.
                </p>
              ) : canCreate ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/inventario/documentos/nuevo')}
                >
                  Nueva recepción
                </Button>
              ) : null}
            </div>
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
              searchPlaceholder="Buscar bodega…"
              searchKeys={['warehouseName', 'destinationWarehouseName', 'notes']}
              toolbarRight={
                <GridDateRangeBox
                  from={from}
                  to={to}
                  lookback={lookback}
                  disabled={loading}
                  onChange={setRange}
                />
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
        </div>
      </div>
    </TenantSessionGate>
  )
}
