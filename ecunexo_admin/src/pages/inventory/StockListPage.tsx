import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Popup, TextBox, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
} from '@/components/ui'
import { Eye, Settings2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { buildAttributeSearchString, flattenAttributeEntries } from '@/lib/catalogAttributes'
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
  const [inspectingStock, setInspectingStock] = useState<Row | null>(null)
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
        id: 'kardex',
        label: 'Kárdex',
        icon: 'receipt',
        route: '/inventario/kardex',
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
        width: 240,
        sortable: true,
        renderCell: (_v: Row['catalogItemName'], row: Row) => (
          <div>
            <strong>{row.catalogItemName}</strong>
            {row.isBelowMinimum ? (
              <div style={{ marginTop: 2 }}>
                <StatusBadge tone="danger" withDot>
                  Bajo mínimo
                </StatusBadge>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'sku',
        header: 'SKU',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['sku'], row: Row) =>
          row.sku ? <code className="ecu-code">{row.sku}</code> : '—',
      },
      {
        key: 'warehouseName',
        header: 'Bodega',
        width: 160,
        sortable: true,
        renderCell: (_v: Row['warehouseName'], row: Row) => row.warehouseName,
      },
      {
        key: 'quantity',
        header: 'Cantidad actual',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['quantity'], row: Row) => (
          <span
            style={
              row.isBelowMinimum
                ? { color: 'var(--color-danger, #ef4444)', fontWeight: 600 }
                : { fontWeight: 500 }
            }
          >
            {row.quantity.toFixed(2)}
          </span>
        ),
      },
      {
        key: 'minimumQuantity',
        header: 'Umbral mínimo',
        width: 180,
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
          return row.minimumQuantity == null ? (
            <span className="app-shell__muted">—</span>
          ) : (
            <span>{row.minimumQuantity.toFixed(2)}</span>
          )
        },
      },
      {
        key: 'updatedAt',
        header: 'Última actualización',
        width: 170,
        sortable: true,
        renderCell: (_v: Row['updatedAt'], row: Row) =>
          row.updatedAt ? formatDateTime(row.updatedAt) : '—',
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: canManage ? 96 : 56,
        align: 'center' as const,
        sortable: false,
        renderCell: (_v: Row['id'], row: Row) => (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            <GridIconButton
              label="Ver ficha técnica"
              icon={Eye}
              onClick={() => setInspectingStock(row)}
            />
            {canManage ? (
              <GridIconButton
                label="Configurar mínimo"
                icon={Settings2}
                onClick={() => startEdit(row)}
              />
            ) : null}
          </div>
        ),
      },
    ],
    [busyId, canManage, editValue, editingId, saveMinimum, startEdit]
  )

  const lowCount = rows.filter((r) => r.isBelowMinimum).length
  const warehouseCount = new Set(rows.map((r) => r.warehouseId)).size

  const enrichedRows = useMemo<Row[]>(
    () =>
      rows.map((r) => ({
        ...r,
        customAttributesSearch: buildAttributeSearchString(r.customAttributesJson),
      })),
    [rows]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Stock" lead="Saldos actuales por ítem y bodega.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres inventory.stock.read para visualizar existencias de inventario."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Stock"
      lead="Control de existencias actuales en tiempo real. Los movimientos históricos residen en el kárdex."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Control de Stock y Existencias"
          subtitle="Saldos físicos actuales por ítem y bodega. Configura umbrales mínimos para detectar alertas de reposición preventiva."
          badge={
            <StatusBadge
              tone={lowCount > 0 ? 'warning' : 'primary'}
              withDot={lowCount > 0}
            >
              {rows.length} {rows.length === 1 ? 'Saldo' : 'Saldos'}
            </StatusBadge>
          }
          actions={
            <>
              {canCreateDoc && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/inventario/documentos/nuevo?tipo=0')}
                >
                  + Nueva Recepción
                </Button>
              )}
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
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de stock">
          <StatCard
            label="Total Saldos"
            value={rows.length}
            icon="inventory_2"
            toneColor="#4f46e5"
            footerText="Ítems con existencia"
          />
          <StatCard
            label="Bajo Mínimo (Alerta)"
            value={lowCount}
            icon="warning"
            toneColor={lowCount > 0 ? '#ef4444' : '#10b981'}
            footerText={lowCount > 0 ? 'Requieren reposición' : 'Nivel de stock óptimo'}
          />
          <StatCard
            label="Bodegas Activas"
            value={warehouseCount}
            icon="warehouse"
            toneColor="#0ea5e9"
            footerText="Puntos con existencias"
          />
          <StatCard
            label="Filtro Activo"
            value={belowOnly ? 'Solo alertas' : 'Todos'}
            icon="filter_alt"
            toneColor="#8b5cf6"
            footerText={belowOnly ? 'Filtrando bajo mínimo' : 'Vista completa'}
          />
        </div>

        <SectionCard
          title="Saldos de Inventario"
          subtitle="Monitoreo en tiempo real de unidades disponibles y umbrales mínimos de stock"
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {rows.length === 0 && !loading ? (
            <EmptyState
              icon="inventory_2"
              title={belowOnly ? 'Ningún ítem bajo el umbral mínimo' : 'Aún no hay saldos de stock'}
              description={
                belowOnly
                  ? 'Todos los productos cuentan con existencias superiores al umbral o no se han configurado mínimos.'
                  : 'Registra y aprueba un documento de recepción para ingresar existencias al almacén.'
              }
              action={
                canCreateDoc && !belowOnly ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/inventario/documentos/nuevo?tipo=0')}
                  >
                    + Nueva Recepción
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={enrichedRows}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={320}
              searchPlaceholder="Buscar ítem, SKU, bodega o especificaciones…"
              searchKeys={['catalogItemName', 'sku', 'warehouseName', 'customAttributesSearch']}
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

      <Popup
        open={inspectingStock !== null}
        title={inspectingStock ? `Ficha técnica: ${inspectingStock.catalogItemName}` : 'Ficha técnica'}
        onClose={() => setInspectingStock(null)}
        width="min(94vw, 38rem)"
        actions={[
          {
            id: 'close',
            label: 'Cerrar',
            variant: 'ghost',
            onClick: () => setInspectingStock(null),
          },
        ]}
      >
        {inspectingStock ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.75rem',
                padding: '0.85rem',
                borderRadius: '8px',
                background: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.03))',
                border: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #6b7280)', display: 'block' }}>
                  SKU / Referencia
                </span>
                <strong style={{ fontSize: '0.9rem' }}>{inspectingStock.sku || '—'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #6b7280)', display: 'block' }}>
                  Bodega
                </span>
                <strong style={{ fontSize: '0.9rem' }}>{inspectingStock.warehouseName}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #6b7280)', display: 'block' }}>
                  Existencias en stock
                </span>
                <strong
                  style={{
                    fontSize: '0.9rem',
                    color: inspectingStock.isBelowMinimum ? 'var(--color-danger, #ef4444)' : 'inherit',
                  }}
                >
                  {inspectingStock.quantity.toFixed(2)}
                </strong>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', fontWeight: 600 }}>
                Especificaciones y Atributos Técnicos
              </h4>
              {(() => {
                const entries = flattenAttributeEntries(inspectingStock.customAttributesJson)
                if (entries.length === 0) {
                  return (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--glb-muted, #6b7280)' }}>
                      Este ítem no tiene especificaciones ni atributos dinámicos configurados en su catálogo.
                    </p>
                  )
                }

                const grouped = new Map<string, typeof entries>()
                for (const entry of entries) {
                  const g = entry.group || 'Características generales'
                  if (!grouped.has(g)) grouped.set(g, [])
                  grouped.get(g)!.push(entry)
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {Array.from(grouped.entries()).map(([groupName, items]) => (
                      <div
                        key={groupName}
                        style={{
                          border: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
                          borderRadius: '8px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            background: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.03))',
                            padding: '0.45rem 0.8rem',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            borderBottom: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.06))',
                          }}
                        >
                          {groupName}
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                            gap: '0.6rem 1rem',
                            padding: '0.75rem 0.8rem',
                            fontSize: '0.85rem',
                          }}
                        >
                          {items.map((item) => (
                            <div key={item.key}>
                              <span
                                style={{
                                  color: 'var(--glb-muted, #6b7280)',
                                  fontSize: '0.75rem',
                                  display: 'block',
                                }}
                              >
                                {item.label}
                              </span>
                              <span style={{ fontWeight: 500 }}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}
