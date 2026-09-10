import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Eye, Plus } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { downloadRepairTemplate, listRepairBatches } from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  repairBatchStatusBadgeTone,
  repairBatchStatusLabel,
  RepairBatchStatus,
  type BatchListItemDto,
} from '@/types/repairsApi'

type Row = BatchListItemDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('lote', 'lotes')

export function RepairsBatchesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('repairs.batches.read')
  const canImport = useHasPermission('repairs.batches.import')
  const canReadDispatches = useHasPermission('repairs.dispatches.read')
  const canViewPortal = useHasPermission('repairs.b2b.portal.view')

  const [rows, setRows] = useState<BatchListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        const data = await listRepairBatches(tenantId)
        setRows(data)
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Lotes sincronizados con éxito.', variant: 'success' })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar los lotes de reparación.')
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
    void load({ silent: true })
  }, [load])

  const handleDownloadTemplate = async () => {
    if (!tenantId) return
    setDownloadingTemplate(true)
    try {
      const blob = await downloadRepairTemplate(tenantId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Plantilla_Lote_Equipos_Taller.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.show({
        title: 'Plantilla generada',
        message: 'Se ha descargado la plantilla oficial Excel con validaciones.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo generar la plantilla Excel.'),
        variant: 'error',
      })
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const totals = useMemo(() => {
    let totalEquipments = 0
    let inRepair = 0
    let ready = 0
    let dispatched = 0

    for (const r of rows) {
      if (r.status === RepairBatchStatus.Cancelled) continue
      totalEquipments += r.totalCount
      inRepair += r.inRepairCount + r.receivedCount
      ready += r.readyCount
      dispatched += r.dispatchedCount
    }

    return { totalEquipments, inRepair, ready, dispatched }
  }, [rows])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'batchNumber',
        header: 'Nº Lote',
        width: 170,
        sortable: true,
        renderCell: (_v: Row['batchNumber'], row: Row) => (
          <button
            type="button"
            className="font-medium text-primary hover:underline cursor-pointer text-left bg-transparent border-none p-0"
            onClick={() => navigate(`/taller/lotes/${row.id}`)}
          >
            {row.batchNumber}
          </button>
        ),
      },
      {
        key: 'customerName',
        header: 'Cliente / Fabricante',
        width: 220,
        sortable: true,
        renderCell: (_v: Row['customerName'], row: Row) => (
          <div className="font-semibold text-slate-800 dark:text-slate-100">
            {row.customerName}
          </div>
        ),
      },
      {
        key: 'receivedAt',
        header: 'Ingreso',
        width: 120,
        sortable: true,
        renderCell: (_v: Row['receivedAt'], row: Row) => (
          <span>{formatDate(row.receivedAt)}</span>
        ),
      },
      {
        key: 'totalCount',
        header: 'Total Equipos',
        width: 110,
        align: 'center',
        sortable: true,
        renderCell: (_v: Row['totalCount'], row: Row) => (
          <span className="font-semibold">{row.totalCount}</span>
        ),
      },
      {
        key: 'inRepairCount',
        header: 'En Proceso',
        width: 110,
        align: 'center',
        renderCell: (_v: Row['inRepairCount'], row: Row) => (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {row.inRepairCount + row.receivedCount}
          </span>
        ),
      },
      {
        key: 'readyCount',
        header: 'Listos Retiro',
        width: 110,
        align: 'center',
        renderCell: (_v: Row['readyCount'], row: Row) => (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {row.readyCount}
          </span>
        ),
      },
      {
        key: 'progressPercentage',
        header: 'Avance',
        width: 160,
        renderCell: (_v: Row['progressPercentage'], row: Row) => (
          <div className="w-full flex items-center gap-2">
            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(row.progressPercentage, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {row.progressPercentage}%
            </span>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 140,
        sortable: true,
        renderCell: (_v: Row['status'], row: Row) => (
          <StatusBadge tone={repairBatchStatusBadgeTone(row.status)} withDot>
            {repairBatchStatusLabel(row.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'id',
        header: '',
        width: 80,
        align: 'center',
        renderCell: (_v: unknown, row: Row) => (
          <GridIconButton
            icon={Eye}
            label="Ver detalle del lote"
            onClick={() => navigate(`/taller/lotes/${row.id}`)}
          />
        ),
      },
    ],
    [navigate]
  )

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = [
      {
        id: 'template',
        label: 'Plantilla Excel',
        icon: 'download',
        route: null,
        disabled: downloadingTemplate,
      },
      {
        id: 'refresh',
        label: 'Actualizar',
        icon: 'refresh-cw',
        route: null,
        disabled: loading,
      },
    ]
    if (canReadDispatches) {
      items.push({
        id: 'dispatches',
        label: 'Actas de despacho',
        icon: 'truck',
        route: '/taller/despachos',
        disabled: false,
      })
    }
    if (canViewPortal) {
      items.push({
        id: 'portal',
        label: 'Portal Corporativo',
        icon: 'shield-check',
        route: '/taller/portal',
        disabled: false,
      })
    }
    return items
  }, [canReadDispatches, canViewPortal, downloadingTemplate, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
      } else if (item.id === 'template') {
        void handleDownloadTemplate()
      }
    },
    [load, tenantId]
  )

  if (!canRead) {
    return (
      <TenantSessionGate
        title="Reparaciones"
        lead="Recepción masiva de electrodomésticos y servicio técnico autorizado."
      >
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso repairs.batches.read para visualizar los lotes de reparación."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Lotes de Reparación"
      lead="Control masivo de electrodomésticos en reacondicionamiento y contratos aliados."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Lotes de Reparación B2B"
          subtitle="Recepción masiva de electrodomésticos, control de avance por fases técnicas y actas de despacho para fabricantes aliados."
          badge={
            <StatusBadge tone="primary" withDot>
              {rows.length} {rows.length === 1 ? 'Lote registrado' : 'Lotes registrados'}
            </StatusBadge>
          }
          actions={
            <>
              {canImport && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/taller/lotes/nuevo')}
                >
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Importar Lote
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de lotes"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen operativo del taller">
          <StatCard
            label="Total Equipos"
            value={totals.totalEquipments}
            icon="inventory_2"
            toneColor="#4f46e5"
            footerText={`En ${rows.length} ${rows.length === 1 ? 'lote recibido' : 'lotes recibidos'}`}
          />
          <StatCard
            label="En Diagnóstico / Proceso"
            value={totals.inRepair}
            icon="build"
            toneColor="#f59e0b"
            footerText="En mesas de trabajo técnicas"
          />
          <StatCard
            label="Listos para Retiro"
            value={totals.ready}
            icon="verified"
            toneColor="#10b981"
            footerText="Control de calidad superado"
          />
          <StatCard
            label="Despachados"
            value={totals.dispatched}
            icon="local_shipping"
            toneColor="#3b82f6"
            footerText="Con acta oficial y código QR"
          />
        </div>

        <SectionCard
          title="Lotes Recibidos"
          subtitle="Listado cronológico de ingresos por contrato corporativo"
        >
          {error && (
            <div className="ecu-form-error-banner mb-4" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {rows.length === 0 && !loading ? (
            <EmptyState
              icon="layers"
              title="Aún no hay lotes registrados"
              description="Descarga la plantilla de Excel oficial para preparar los números de serie o importa directamente el archivo entregado por el cliente corporativo."
              action={
                canImport ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/taller/lotes/nuevo')}
                  >
                    <Plus size={16} strokeWidth={2} aria-hidden />
                    Importar Primer Lote
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-repairs-grid"
              dataSource={rows as Row[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar por lote o cliente..."
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
