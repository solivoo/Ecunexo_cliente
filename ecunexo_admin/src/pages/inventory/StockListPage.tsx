import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, TextBox, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { Settings2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { listStock, setStockMinimum } from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { StockListItemDto } from '@/types/inventoryApi'

type Row = StockListItemDto & Record<string, unknown>
const messages = createSpanishDataGridMessages('saldo', 'saldos')

export function StockListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('inventory.stock.read')
  const canManage =
    useHasPermission('inventory.stock.manage') || useHasPermission('inventory.documents.approve')
  const canCreateDoc = useHasPermission('inventory.documents.create')
  const [rows, setRows] = useState<StockListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [belowOnly, setBelowOnly] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(
    async (opts?: { silent?: boolean; belowMinimumOnly?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(
          await listStock(tenantId, {
            belowMinimumOnly: opts?.belowMinimumOnly ?? belowOnly,
          })
        )
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Saldos sincronizados.', variant: 'success' })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar el stock.')
        setError(message)
        setRows([])
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [belowOnly, tenantId, toast]
  )

  useEffect(() => {
    if (canRead) void load({ silent: true })
  }, [canRead, load])

  const startEdit = useCallback((row: StockListItemDto) => {
    setEditingId(row.id)
    setEditValue(row.minimumQuantity == null ? '' : String(row.minimumQuantity))
  }, [])

  const saveMinimum = useCallback(
    async (stockId: string) => {
      if (!tenantId) return
      setBusyId(stockId)
      try {
        const trimmed = editValue.trim()
        const minimumQuantity = trimmed === '' ? null : Number(trimmed.replace(',', '.'))
        if (minimumQuantity !== null && (Number.isNaN(minimumQuantity) || minimumQuantity < 0)) {
          throw new Error('El mínimo debe ser un número ≥ 0 (vacío = sin alerta).')
        }
        const updated = await setStockMinimum(tenantId, stockId, minimumQuantity)
        setRows((prev) =>
          prev.map((r) =>
            r.id === stockId
              ? {
                  ...r,
                  minimumQuantity: updated.minimumQuantity,
                  isBelowMinimum: updated.isBelowMinimum,
                  quantity: updated.quantity,
                }
              : r
          )
        )
        setEditingId(null)
        toast.show({
          title: 'Umbral guardado',
          message:
            updated.isBelowMinimum
              ? 'Este ítem quedó marcado como bajo mínimo.'
              : 'Alerta de stock mínimo actualizada.',
          variant: updated.isBelowMinimum ? 'warning' : 'success',
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar.')
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setBusyId(null)
      }
    },
    [editValue, tenantId, toast]
  )

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canCreateDoc) {
      items.push({
        id: 'receive',
        label: 'Nueva recepción',
        icon: 'plus',
        route: '/inventario/documentos/nuevo?tipo=0',
        disabled: false,
      })
    }
    items.push(
      {
        id: 'toggle-low',
        label: belowOnly ? 'Ver todos' : 'Solo bajo mínimo',
        icon: 'alert-triangle',
        route: null,
        disabled: loading,
      },
      {
        id: 'docs',
        label: 'Documentos',
        icon: 'file-text',
        route: '/inventario/documentos',
        disabled: false,
      },
      {
        id: 'refresh',
        label: 'Actualizar',
        icon: 'refresh-cw',
        route: null,
        disabled: loading,
      }
    )
    return items
  }, [belowOnly, canCreateDoc, loading])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'catalogItemName',
        header: 'Ítem',
        width: 220,
        sortable: true,
        renderCell: (_v: Row['catalogItemName'], row: Row) => (
          <strong>
            {row.catalogItemName}
            {row.isBelowMinimum ? (
              <span className="app-shell__muted"> · bajo mínimo</span>
            ) : null}
          </strong>
        ),
      },
      {
        key: 'sku',
        header: 'SKU',
        width: 120,
        sortable: true,
        renderCell: (_v: Row['sku'], row: Row) => row.sku ?? '—',
      },
      {
        key: 'warehouseName',
        header: 'Bodega',
        width: 150,
        sortable: true,
        renderCell: (_v: Row['warehouseName'], row: Row) => row.warehouseName,
      },
      {
        key: 'quantity',
        header: 'Cantidad',
        width: 110,
        sortable: true,
        renderCell: (_v: Row['quantity'], row: Row) => (
          <span style={row.isBelowMinimum ? { color: 'var(--color-danger, #b42318)', fontWeight: 600 } : undefined}>
            {row.quantity.toFixed(2)}
          </span>
        ),
      },
      {
        key: 'minimumQuantity',
        header: 'Mínimo',
        width: 160,
        sortable: true,
        renderCell: (_v: Row['minimumQuantity'], row: Row) => {
          if (editingId === row.id) {
            return (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <TextBox
                  id={`min-${row.id}`}
                  label=""
                  labelPosition="outlined"
                  variant="outline"
                  value={editValue}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                  disabled={busyId === row.id}
                  fullWidth
                />
                <Button
                  type="button"
                  variant="primary"
                  loading={busyId === row.id}
                  disabled={busyId === row.id}
                  onClick={() => void saveMinimum(row.id)}
                >
                  OK
                </Button>
              </div>
            )
          }
          return row.minimumQuantity == null ? '—' : row.minimumQuantity.toFixed(2)
        },
      },
      {
        key: 'updatedAt',
        header: 'Actualizado',
        width: 150,
        sortable: true,
        renderCell: (_v: Row['updatedAt'], row: Row) =>
          row.updatedAt ? formatDateTime(row.updatedAt) : '—',
      },
      ...(canManage
        ? ([
            {
              key: 'id',
              header: '',
              width: 56,
              align: 'center' as const,
              sortable: false,
              renderCell: (_v: Row['id'], row: Row) => (
                <GridIconButton
                  label="Definir mínimo"
                  icon={Settings2}
                  onClick={() => startEdit(row)}
                />
              ),
            },
          ] satisfies ColumnDef<Row>[])
        : []),
    ],
    [busyId, canManage, editValue, editingId, saveMinimum, startEdit]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Stock" lead="Saldos actuales por ítem y bodega.">
        <p className="app-shell__page-lead">Requieres inventory.stock.read.</p>
      </TenantSessionGate>
    )
  }

  const lowCount = rows.filter((r) => r.isBelowMinimum).length
  const warehouseCount = new Set(rows.map((r) => r.warehouseId)).size

  return (
    <TenantSessionGate title="Stock" lead="Cuánto hay ahora. El histórico está en el kárdex.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            {belowOnly
              ? `Mostrando solo alertas (${lowCount}).`
              : `Define un mínimo por ítem/bodega para ver alertas. ${
                  lowCount > 0 ? `Ahora hay ${lowCount} bajo mínimo.` : ''
                }`}
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de stock"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={(item: PageActionItem) => {
              if (item.id === 'refresh') void load()
              if (item.id === 'toggle-low') {
                const next = !belowOnly
                setBelowOnly(next)
                void load({ silent: true, belowMinimumOnly: next })
              }
            }}
          />
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de stock">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Saldos</p>
            <p className="ecu-companies-page__metric-value">{rows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Bajo mínimo</p>
            <p className="ecu-companies-page__metric-value">{lowCount}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Bodegas</p>
            <p className="ecu-companies-page__metric-value">{warehouseCount}</p>
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
              <h2 className="app-shell__section-title">
                {belowOnly ? 'Ningún ítem bajo mínimo' : 'Aún no hay saldos'}
              </h2>
              <p className="app-shell__muted">
                {belowOnly
                  ? 'Todos los umbrales están cubiertos o no hay mínimos configurados.'
                  : 'Aprueba una recepción para ver cantidades aquí.'}
              </p>
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
              searchPlaceholder="Buscar ítem o bodega…"
              searchKeys={['catalogItemName', 'sku', 'warehouseName']}
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
