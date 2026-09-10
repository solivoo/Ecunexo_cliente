import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Select, TextBox, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import {
  Download,
  Eye,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  downloadRepairTemplate,
  listBatchEquipments,
  listRepairBatches,
  listRepairCustomers,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  damageLevelBadgeTone,
  damageLevelLabel,
  repairBatchStatusBadgeTone,
  repairBatchStatusLabel,
  repairEquipmentStatusBadgeTone,
  repairEquipmentStatusLabel,
  type BatchListItemDto,
  type CustomerDto,
  type RepairEquipmentDto,
} from '@/types/repairsApi'

type BatchRow = BatchListItemDto & Record<string, unknown>
type EquipmentRow = RepairEquipmentDto & { batchNumber?: string } & Record<string, unknown>

const messages = createSpanishDataGridMessages('lote', 'lotes')

export function CorporatePortalPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canViewPortal = useHasPermission('repairs.b2b.portal.view')
  const canReadBatches = useHasPermission('repairs.batches.read')
  const canReadDispatches = useHasPermission('repairs.dispatches.read')

  const [customers, setCustomers] = useState<CustomerDto[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [batches, setBatches] = useState<BatchListItemDto[]>([])
  const [allEquipments, setAllEquipments] = useState<EquipmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchSerial, setSearchSerial] = useState('')
  const [downloadingReport, setDownloadingReport] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(async (customerIdFilter?: string) => {
    if (!tenantId) return
    setLoading(true)
    try {
      const custList = await listRepairCustomers(tenantId)
      setCustomers(custList)

      const effectiveCustomerId = customerIdFilter !== undefined ? customerIdFilter : selectedCustomerId
      const bList = await listRepairBatches(
        tenantId,
        effectiveCustomerId ? { customerId: effectiveCustomerId } : undefined
      )
      setBatches(bList)

      // Cargar equipos de los primeros lotes para el buscador instantáneo
      const equipmentPromises = bList.slice(0, 5).map(async (b) => {
        const eqs = await listBatchEquipments(tenantId, b.id)
        return eqs.map((e) => ({ ...e, batchNumber: b.batchNumber }))
      })

      const nested = await Promise.all(equipmentPromises)
      setAllEquipments(nested.flat())
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudieron cargar los datos del portal corporativo.'))
    } finally {
      setLoading(false)
    }
  }, [selectedCustomerId, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const handleCustomerChange = (val: string) => {
    setSelectedCustomerId(val)
    void load(val)
  }

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canReadBatches) {
      items.push({
        id: 'batches',
        label: 'Lotes de taller',
        icon: 'layers',
        route: '/taller/lotes',
        disabled: false,
      })
    }
    if (canReadDispatches) {
      items.push({
        id: 'dispatches',
        label: 'Actas de despacho',
        icon: 'truck',
        route: '/taller/despachos',
        disabled: false,
      })
    }
    items.push(
      {
        id: 'report',
        label: 'Descargar informe Excel',
        icon: 'download',
        route: null,
        disabled: downloadingReport,
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
  }, [canReadBatches, canReadDispatches, downloadingReport, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
      } else if (item.id === 'report') {
        void handleDownloadReport()
      }
    },
    [load]
  )

  // KPIs
  const totals = useMemo(() => {
    let total = 0
    let inRepair = 0
    let ready = 0
    let dispatched = 0

    for (const b of batches) {
      total += b.totalCount
      inRepair += b.inRepairCount + b.receivedCount
      ready += b.readyCount
      dispatched += b.dispatchedCount
    }

    const efficiency =
      total > 0 ? Math.round(((ready + dispatched) / total) * 100) : 100

    return { total, inRepair, ready, dispatched, efficiency }
  }, [batches])

  // Búsqueda instantánea por serie
  const searchResults = useMemo(() => {
    const q = searchSerial.trim().toLowerCase()
    if (!q) return []
    return allEquipments.filter(
      (e) =>
        e.serialNumber.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q) ||
        e.brand.toLowerCase().includes(q)
    )
  }, [allEquipments, searchSerial])

  const handleDownloadReport = async () => {
    if (!tenantId) return
    setDownloadingReport(true)
    try {
      const blob = await downloadRepairTemplate(tenantId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Reporte_Corporativo_Taller_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.show({
        title: 'Reporte generado',
        message: 'Descarga completada con la trazabilidad auditada de equipos.',
        variant: 'success',
      })
    } catch {
      toast.show({ title: 'Error', message: 'No se pudo generar el reporte.', variant: 'error' })
    } finally {
      setDownloadingReport(false)
    }
  }

  const batchColumns = useMemo(
    (): ColumnDef<BatchRow>[] => [
      {
        key: 'batchNumber',
        header: 'Nº Lote',
        width: 180,
        sortable: true,
        renderCell: (_v: BatchRow['batchNumber'], row: BatchRow) => (
          <button
            type="button"
            className="font-bold text-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
            onClick={() => navigate(`/taller/lotes/${row.id}`)}
          >
            {row.batchNumber}
          </button>
        ),
      },
      {
        key: 'receivedAt',
        header: 'Fecha Ingreso',
        width: 130,
        sortable: true,
        renderCell: (_v: BatchRow['receivedAt'], row: BatchRow) => (
          <span>{formatDate(row.receivedAt)}</span>
        ),
      },
      {
        key: 'totalCount',
        header: 'Total Equipos',
        width: 110,
        align: 'center',
        renderCell: (_v: BatchRow['totalCount'], row: BatchRow) => (
          <span className="font-semibold">{row.totalCount}</span>
        ),
      },
      {
        key: 'readyCount',
        header: 'Listos para Retiro',
        width: 130,
        align: 'center',
        renderCell: (_v: BatchRow['readyCount'], row: BatchRow) => (
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {row.readyCount} unidades
          </span>
        ),
      },
      {
        key: 'progressPercentage',
        header: 'Progreso de Reacondicionamiento',
        width: 220,
        renderCell: (_v: BatchRow['progressPercentage'], row: BatchRow) => (
          <div className="w-full flex items-center gap-2">
            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(row.progressPercentage, 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {row.progressPercentage}%
            </span>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 140,
        renderCell: (_v: BatchRow['status'], row: BatchRow) => (
          <StatusBadge tone={repairBatchStatusBadgeTone(row.status)} withDot>
            {repairBatchStatusLabel(row.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'id',
        header: '',
        width: 70,
        align: 'center',
        renderCell: (_v: unknown, row: BatchRow) => (
          <GridIconButton
            icon={Eye}
            label="Ver auditoría del lote"
            onClick={() => navigate(`/taller/lotes/${row.id}`)}
          />
        ),
      },
    ],
    [navigate]
  )

  if (!canViewPortal) {
    return (
      <TenantSessionGate
        title="Portal Corporativo B2B"
        lead="Auditoría y trazabilidad para clientes corporativos y marcas aliadas."
      >
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso repairs.b2b.portal.view para acceder al portal corporativo."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Portal Corporativo B2B"
      lead="Supervisión en tiempo real de equipos en garantía y órdenes de reacondicionamiento."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Portal Corporativo B2B"
          subtitle="Monitoreo en tiempo real de lotes en reacondicionamiento, disponibilidad inmediata para coordinación logística de transporte y verificación de series auditada."
          badge={
            <StatusBadge tone="info" withDot>
              Auditoría B2B Certificada
            </StatusBadge>
          }
          actions={
            <>
              {customers.length > 1 && (
                <Select
                  id="portal-customer-filter"
                  aria-label="Filtrar por empresa cliente"
                  options={[
                    { value: '', label: 'Todos los clientes' },
                    ...customers.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                  placeholder="Empresa cliente..."
                  width="14rem"
                />
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadReport}
                disabled={downloadingReport}
              >
                <Download size={16} strokeWidth={2} aria-hidden />
                {downloadingReport ? 'Generando...' : 'Descargar Informe Excel'}
              </Button>
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de portal"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Métricas operativas corporativas">
          <StatCard
            label="Total Equipos Entregados"
            value={totals.total}
            icon="inventory_2"
            toneColor="#4f46e5"
            footerText="En custodia del taller"
          />
          <StatCard
            label="En Mesa de Trabajo"
            value={totals.inRepair}
            icon="build"
            toneColor="#f59e0b"
            footerText="En fase de diagnóstico o chapa"
          />
          <StatCard
            label="Listos para Retiro Inmediato"
            value={totals.ready}
            icon="verified"
            toneColor="#10b981"
            footerText="Coordinar transporte de retiro"
          />
          <StatCard
            label="Nivel de Cumplimiento"
            value={`${totals.efficiency}%`}
            icon="task_alt"
            toneColor="#3b82f6"
            footerText="Tasa de equipos recuperados"
          />
        </div>

        {/* Buscador Instantáneo por Número de Serie */}
        <SectionCard
          title="Rastreo Instantáneo por Número de Serie"
          subtitle="Consulta el estado exacto de cualquier electrodoméstico o equipo registrado en los lotes"
        >
          <div className="relative mb-4">
            <TextBox
              id="search-serial-input"
              label="Buscar por número de serie"
              labelPosition="outlined"
              variant="outline"
              value={searchSerial}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchSerial(e.target.value)}
              placeholder="Escribe el número de serie para buscar en todos los lotes (ej. SN123456789)..."
              fullWidth
            />
          </div>

          {searchSerial.trim() && (
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Resultados encontrados ({searchResults.length})
              </h3>
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  No se encontró ningún equipo con la serie "{searchSerial}".
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((eq) => (
                    <div
                      key={eq.id}
                      className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm hover:border-primary/50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {eq.serialNumber}
                          </span>
                          <StatusBadge tone={damageLevelBadgeTone(eq.damageLevel)}>
                            {damageLevelLabel(eq.damageLevel)}
                          </StatusBadge>
                          {eq.batchNumber && (
                            <span className="text-xs text-slate-500">
                              Lote: <strong>{eq.batchNumber}</strong>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {eq.brand} {eq.model}
                          {eq.diagnosticNotes ? ` — Diagnóstico: ${eq.diagnosticNotes}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusBadge tone={repairEquipmentStatusBadgeTone(eq.status)} withDot>
                          {repairEquipmentStatusLabel(eq.status)}
                        </StatusBadge>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate(`/taller/lotes/${eq.batchId}`)}
                        >
                          Ver Lote
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Lotes Activos Corporativos */}
        <SectionCard
          title="Lotes en Taller"
          subtitle="Avance consolidado de los lotes entregados bajo contrato corporativo"
        >
          {error && (
            <div className="ecu-form-error-banner mb-4" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {batches.length === 0 && !loading ? (
            <EmptyState
              icon="layers"
              title="No hay lotes registrados para esta empresa"
              description="Cuando el taller reciba un nuevo lote, se reflejará inmediatamente en este portal con las estadísticas de avance y números de serie."
            />
          ) : (
            <DataGrid
              className="ecu-repairs-grid"
              dataSource={batches as BatchRow[]}
              keyExpr="id"
              columns={batchColumns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={260}
              searchPlaceholder="Filtrar lotes..."
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

export const WhirlpoolPortalPage = CorporatePortalPage
