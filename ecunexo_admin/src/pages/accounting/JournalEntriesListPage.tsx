import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox } from 'glubox'
import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { useAppToast } from '@/components/toast/useAppToast'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { listJournalEntries } from '@/services/journalEntriesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { JournalEntrySummaryDto, ListJournalEntriesKpisDto } from '@/types/journalEntriesApi'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: '2', label: 'Contabilizado' },
  { value: '1', label: 'Borrador' },
  { value: '3', label: 'Anulado' },
]

const SOURCE_LABELS: Record<string, string> = {
  Manual: 'Manual',
  SalesInvoice: 'Factura Venta',
  PurchaseInvoice: 'Factura Compra',
  PurchaseSettlement: 'Liquidación Compra (03)',
  InventoryReceipt: 'Ingreso Bodega',
  InventoryDispatch: 'Despacho Bodega',
  PaymentReceipt: 'Cobro Cliente',
  SupplierPayment: 'Pago Proveedor',
}

export default function JournalEntriesListPage() {
  const tenantId = useAppSelector(selectTenantId)
  const toast = useAppToast()
  const navigate = useNavigate()

  const canManage = useHasPermission('contabilidad.asientos.manage')

  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<JournalEntrySummaryDto[]>([])
  const [kpis, setKpis] = useState<ListJournalEntriesKpisDto>({
    totalEntries: 0,
    totalPosted: 0,
    totalDraft: 0,
    totalDebitVolume: 0,
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchEntries = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const res = await listJournalEntries(tenantId, {
        search: search.trim() || undefined,
        status: statusFilter ? Number(statusFilter) : undefined,
      })
      setEntries(res.entries)
      setKpis(res.kpis)
    } catch (err) {
      toast.error(
        'Error al cargar el Libro Diario',
        readApiError(err, 'No se pudo obtener el historial de asientos contables.')
      )
    } finally {
      setLoading(false)
    }
  }, [tenantId, search, statusFilter, toast])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val)

  return (
    <TenantSessionGate
      title="Libro Diario"
      lead="Registro cronológico de hechos económicos bajo el principio de partida doble y cuadre estricto."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Libro Diario"
          subtitle="Registro cronológico de hechos económicos bajo el principio de partida doble y cuadre estricto."
          badge={
            <StatusBadge tone="primary" withDot>
              NIIF / SCVS Ecuador
            </StatusBadge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={fetchEntries}
                disabled={loading}
                title="Actualizar listado"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refrescar
              </Button>
              {canManage && (
                <Button
                  variant="primary"
                  onClick={() => navigate('/contabilidad/asientos/nuevo')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Asiento
                </Button>
              )}
            </div>
          }
        />

        {/* KPIs Strip dentro de ecu-stat-grid según Regla 2 */}
        <div className="ecu-stat-grid mb-6">
          <StatCard
            label="Total Asientos"
            value={kpis.totalEntries}
            icon={<BookOpen size={20} />}
            toneColor="#0284c7"
            footerText="Histórico en el ejercicio"
          />
          <StatCard
            label="Contabilizados"
            value={kpis.totalPosted}
            icon={<CheckCircle2 size={20} />}
            toneColor="#059669"
            footerText="Asientos firmes en mayor"
          />
          <StatCard
            label="En Borrador"
            value={kpis.totalDraft}
            icon={<Clock size={20} />}
            toneColor="#d97706"
            footerText="Pendientes de cuadre/aprobación"
          />
          <StatCard
            label="Volumen Contabilizado"
            value={formatCurrency(kpis.totalDebitVolume)}
            icon={<Scale size={20} />}
            toneColor="#7c3aed"
            footerText="Sumatoria Debe acumulada"
          />
        </div>

        {/* Contenedor SectionCard con toolbar y listado */}
        <SectionCard title="Asientos Contables Registrados">
          {/* Toolbar de filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
            <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1">
                <TextBox
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por número o glosa del asiento..."
                />
              </div>
              <div className="w-48">
                <Select
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(String(val))}
                  options={STATUS_OPTIONS}
                />
              </div>
            </div>
          </div>

          {/* Tabla de Asientos */}
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
              Cargando comprobantes de diario...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                No hay asientos registrados
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Genere asientos manuales o contabilice facturas de compra y liquidaciones SRI.
              </p>
              {canManage && (
                <Button
                  variant="primary"
                  onClick={() => navigate('/contabilidad/asientos/nuevo')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Crear Primer Asiento
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Número</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Glosa / Concepto</th>
                    <th className="py-3 px-4">Origen</th>
                    <th className="py-3 px-4 text-right">Total Debe</th>
                    <th className="py-3 px-4 text-right">Total Haber</th>
                    <th className="py-3 px-4 text-center">Partida Doble</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {entries.map((entry) => {
                    const sourceStr = String(entry.source)
                    const displaySource = SOURCE_LABELS[sourceStr] || sourceStr
                    const isPosted = String(entry.status) === 'Posted' || entry.status === 2

                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {entry.entryNumber}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                          {entry.date}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate" title={entry.description}>
                          {entry.description}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {displaySource}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatCurrency(entry.totalDebit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatCurrency(entry.totalCredit)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {entry.isBalanced ? (
                            <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Cuadrado
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
                              Descuadrado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isPosted ? (
                            <StatusBadge tone="success">Contabilizado</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Borrador</StatusBadge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
