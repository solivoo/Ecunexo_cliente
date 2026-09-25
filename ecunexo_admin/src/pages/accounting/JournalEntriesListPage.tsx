import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Select, TextBox, type ColumnDef } from 'glubox'
import { Plus } from 'lucide-react'
import {
  EmptyState,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { useAppToast } from '@/components/toast/useAppToast'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { formatDate } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import { listJournalEntries } from '@/services/journalEntriesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { JournalEntrySummaryDto, ListJournalEntriesKpisDto } from '@/types/journalEntriesApi'

type JournalEntryRow = JournalEntrySummaryDto & Record<string, unknown>

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

const gridMessages = createSpanishDataGridMessages('asiento', 'asientos')

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

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

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
    void fetchEntries()
  }, [fetchEntries])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val)


  const columns = useMemo(
    (): ColumnDef<JournalEntryRow>[] => [
      {
        key: 'entryNumber',
        header: 'Número',
        width: 140,
        sortable: true,
        renderCell: (_value, row: JournalEntryRow) => (
          <code className="ecu-code">{row.entryNumber}</code>
        ),
      },
      {
        key: 'date',
        header: 'Fecha',
        width: 110,
        sortable: true,
        renderCell: (_value, row: JournalEntryRow) => formatDate(row.date),
      },
      {
        key: 'description',
        header: 'Glosa / Concepto',
        width: 320,
        sortable: true,
        renderCell: (_value, row: JournalEntryRow) => (
          <span className="ecu-clip ecu-clip--wide" title={row.description}>
            {row.description}
          </span>
        ),
      },
      {
        key: 'source',
        header: 'Origen',
        width: 170,
        sortable: true,
        renderCell: (_value, row: JournalEntryRow) => (
          <span className="ecu-chip">
            {SOURCE_LABELS[String(row.source)] || String(row.source)}
          </span>
        ),
      },
      {
        key: 'totalDebit',
        header: 'Debe',
        width: 130,
        align: 'right',
        sortable: true,
        renderCell: (_value, row: JournalEntryRow) => formatCurrency(row.totalDebit),
      },
      {
        key: 'totalCredit',
        header: 'Haber',
        width: 130,
        align: 'right',
        sortable: true,
        renderCell: (_value, row: JournalEntryRow) => formatCurrency(row.totalCredit),
      },
      {
        key: 'isBalanced',
        header: 'Partida doble',
        width: 130,
        sortable: true,
        renderCell: (_value, row: JournalEntryRow) => (
          <span
            className={`ecu-status ${row.isBalanced ? 'ecu-status--active' : 'ecu-status--danger'}`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {row.isBalanced ? 'Cuadrado' : 'Descuadrado'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 140,
        sortable: true,
        renderCell: (_value, row: JournalEntryRow) => {
          const isPosted = String(row.status) === 'Posted' || row.status === 2
          const isCancelled = String(row.status) === 'Cancelled' || row.status === 3
          return (
            <span
              className={`ecu-status ${
                isPosted
                  ? 'ecu-status--active'
                  : isCancelled
                    ? 'ecu-status--danger'
                    : 'ecu-status--warning'
              }`}
            >
              <span className="ecu-status__dot" aria-hidden />
              {isPosted ? 'Contabilizado' : isCancelled ? 'Anulado' : 'Borrador'}
            </span>
          )
        },
      },
    ],
    []
  )

  return (
    <TenantSessionGate
      title="Libro Diario"
      lead="Registro cronológico de hechos económicos bajo el principio de partida doble y cuadre estricto."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-dashboard-layout--fluid">
        <PageHeader
          title="Libro Diario"
          subtitle="Registro cronológico de asientos contables."
          badge={<StatusBadge tone="neutral">NIIF / SCVS Ecuador</StatusBadge>}
        />

        <div className="ecu-stat-grid" aria-label="Resumen del libro diario">
          <StatCard label="Total asientos" value={kpis.totalEntries} />
          <StatCard label="Contabilizados" value={kpis.totalPosted} />
          <StatCard label="En Borrador" value={kpis.totalDraft} />
          <StatCard label="Volumen Contabilizado (USD)" value={formatCurrency(kpis.totalDebitVolume)} />
        </div>

        <SectionCard title="Asientos Contables Registrados">
          {!loading && entries.length === 0 ? (
            <EmptyState
              icon="menu_book"
              title="No hay asientos registrados"
              description="Genere asientos manuales o contabilice facturas de compra y liquidaciones SRI."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate('/contabilidad/asientos/nuevo')}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Crear Primer Asiento
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="ecu-commandbar">
                <div className="ecu-commandbar__search">
                  <TextBox
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por número o glosa del asiento..."
                    fullWidth
                  />
                </div>
                <div className="ecu-commandbar__filter">
                  <Select
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(String(val))}
                    options={STATUS_OPTIONS}
                    fullWidth
                  />
                </div>
                <div className="ecu-commandbar__spacer" />
                <div className="ecu-commandbar__action">
                  <div className="ecu-grid-toolbar-actions">
                    <GridToolbarRefresh
                      loading={loading}
                      onRefresh={() => void fetchEntries()}
                    />
                    {canManage && (
                      <Button
                        variant="primary"
                        onClick={() => navigate('/contabilidad/asientos/nuevo')}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Asiento
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <DataGrid
                className="ecu-companies-grid"
                dataSource={entries as JournalEntryRow[]}
                keyExpr="id"
                columns={columns}
                selectionMode="none"
                showSearch={false}
                loading={loading}
                paging={paging}
                pageSizeOptions={pageSizeOptions}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                messages={gridMessages}
                fullWidth
                stickyFirstColumn
              />
            </>
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
