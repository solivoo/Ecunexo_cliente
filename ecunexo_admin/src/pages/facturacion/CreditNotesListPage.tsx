import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, OptionGroup, useToast, type ColumnDef } from 'glubox'
import {
  CheckCircle2,
  FileCode,
  FileText,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  downloadInvoiceRide,
  downloadInvoiceXml,
} from '@/pages/facturacion/invoiceDownloads'
import { resendInvoiceAndWait } from '@/pages/facturacion/invoiceEmitApi'
import { formatMoney } from '@/pages/facturacion/invoiceFormTypes'
import {
  invoiceStateLabel,
  invoiceStateTone,
  sriTransmissionLabel,
  sriTransmissionTone,
} from '@/pages/facturacion/invoiceStateLabels'
import { useBillingInvoices } from '@/pages/facturacion/useBillingInvoices'
import type { InvoiceListItem } from '@/types/billingApi'

const gridMessages = createSpanishDataGridMessages('nota de crédito', 'notas de crédito')

export function CreditNotesListPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const canRead =
    useHasPermission('facturacion.notas.credito.read') ||
    useHasPermission('facturacion.read') ||
    useHasPermission('facturacion.comprobantes.read')
  const canCreate =
    useHasPermission('facturacion.notas.credito.create') ||
    useHasPermission('facturacion.read')

  const { from, to, lookback, setRange } = useGridDateRange()
  const { rows, loading, emitterId, load } = useBillingInvoices({ from, to })

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  // Filtrar comprobantes de tipo '04' (Nota de Crédito)
  const creditNotes = useMemo(() => {
    let filtered = rows.filter((r) => r.documentType === '04')
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.state === statusFilter)
    }
    return filtered
  }, [rows, statusFilter])

  const stats = useMemo(() => {
    const allNc = rows.filter((r) => r.documentType === '04')
    const total = allNc.length
    const authorized = allNc.filter((i) => i.state === 'Authorized').length
    const draft = allNc.filter(
      (i) => i.state === 'Draft' || i.state === 'Received' || i.state === 'Processing'
    ).length
    const grandTotalSum = allNc.reduce((acc, i) => acc + i.grandTotal, 0)
    return { total, authorized, draft, grandTotalSum }
  }, [rows])

  const handleDownloadPdf = async (row: InvoiceListItem) => {
    if (!emitterId) return
    setBusyId(row.invoiceId)
    try {
      await downloadInvoiceRide(emitterId, row.invoiceId)
      toast.show({ title: 'Éxito', message: 'RIDE PDF generado correctamente.', variant: 'success' })
    } catch (err) {
      toast.show({ title: 'Error', message: readApiError(err, 'Error al generar RIDE PDF.'), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const handleDownloadXml = async (row: InvoiceListItem) => {
    if (!emitterId) return
    setBusyId(row.invoiceId)
    try {
      await downloadInvoiceXml(emitterId, row.invoiceId)
      toast.show({ title: 'Éxito', message: 'XML descargado.', variant: 'success' })
    } catch (err) {
      toast.show({ title: 'Error', message: readApiError(err, 'Error al descargar XML.'), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const handleResendSri = async (row: InvoiceListItem) => {
    if (!emitterId) return
    setBusyId(row.invoiceId)
    try {
      const res = await resendInvoiceAndWait(emitterId, row.invoiceId, {
        sequentialHint: row.sequential,
      })
      toast.show({
        title: res.outcome === 'success' ? 'Éxito' : res.outcome === 'warning' ? 'Advertencia' : 'Error',
        message: res.message,
        variant: res.outcome === 'success' ? 'success' : res.outcome === 'warning' ? 'info' : 'error',
      })
      void load()
    } catch (err) {
      toast.show({ title: 'Error', message: readApiError(err, 'Error al enviar nota de crédito al SRI.'), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo((): ColumnDef<InvoiceListItem>[] => {
    return [
      {
        key: 'issueDate',
        header: 'Fecha',
        width: 110,
        sortable: true,
      },
      {
        key: 'establishment',
        header: 'Estab.',
        width: 70,
      },
      {
        key: 'emissionPoint',
        header: 'Pto.',
        width: 70,
      },
      {
        key: 'sequential',
        header: 'Secuencial',
        width: 110,
        sortable: true,
        renderCell: (_v: unknown, row: InvoiceListItem) => <strong>{row.sequential}</strong>,
      },
      {
        key: 'counterpartyName',
        header: 'Cliente',
        width: 200,
        sortable: true,
        renderCell: (_v: unknown, row: InvoiceListItem) => (
          <div>
            <div className="ecu-companies-cell-primary">{row.counterpartyName}</div>
            <div className="ecu-companies-cell-secondary">{row.counterpartyIdentification}</div>
          </div>
        ),
      },
      {
        key: 'grandTotal',
        header: 'Monto Modificado',
        width: 140,
        align: 'right',
        sortable: true,
        renderCell: (_v: unknown, row: InvoiceListItem) => formatMoney(row.grandTotal),
      },
      {
        key: 'state',
        header: 'Estado SRI',
        width: 130,
        sortable: true,
        renderCell: (_v: unknown, row: InvoiceListItem) => (
          <StatusBadge tone={invoiceStateTone(row.state)}>
            {invoiceStateLabel(row.state)}
          </StatusBadge>
        ),
      },
      {
        key: 'sriTransmissionState',
        header: 'Transmisión',
        width: 130,
        renderCell: (_v: unknown, row: InvoiceListItem) => (
          <StatusBadge tone={sriTransmissionTone(row.sriTransmissionState)}>
            {sriTransmissionLabel(row.sriTransmissionState)}
          </StatusBadge>
        ),
      },
      {
        key: 'sequential',
        header: 'Acciones',
        width: 140,
        align: 'center',
        renderCell: (_v: unknown, row: InvoiceListItem) => (
          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
            <GridIconButton
              label="Descargar RIDE PDF"
              icon={FileText}
              title="Descargar RIDE PDF"
              disabled={busyId === row.invoiceId}
              onClick={() => handleDownloadPdf(row)}
            />
            <GridIconButton
              label="Ver / Descargar XML"
              icon={FileCode}
              title="Descargar XML"
              disabled={busyId === row.invoiceId}
              onClick={() => handleDownloadXml(row)}
            />
            {row.canResend || row.state === 'Draft' ? (
              <GridIconButton
                label="Firmar / Enviar al SRI"
                icon={Send}
                title="Enviar SRI"
                disabled={busyId === row.invoiceId}
                onClick={() => handleResendSri(row)}
              />
            ) : null}
          </div>
        ),
      },
    ]
  }, [busyId, emitterId])

  if (!canRead) {
    return (
      <TenantSessionGate
        title="Notas de Crédito SRI"
        lead="Gestión de anulaciones y devoluciones tributarias SRI"
      >
        <div className="ecu-dashboard-layout">
          <EmptyState
            icon="receipt"
            title="Sin permisos"
            description="No dispones de permisos para consultar el módulo de Notas de Crédito SRI."
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Notas de Crédito SRI"
      lead="Gestión de anulaciones y devoluciones tributarias SRI"
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Notas de Crédito SRI"
          badge={<StatusBadge tone="info">SRI 04</StatusBadge>}
          subtitle="Emisión y gestión de anulaciones y devoluciones tributarias con esquema offline v1.1.0."
          actions={
            canCreate ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => navigate('/facturacion/notas-credito/nueva')}
              >
                + Nueva Nota de Crédito
              </Button>
            ) : undefined
          }
        />

        <div className="ecu-stat-grid">
          <StatCard
            label="Total Registradas"
            value={stats.total.toString()}
            icon={<FileText size={20} />}
            footerText="Comprobantes 04"
          />
          <StatCard
            label="Autorizadas SRI"
            value={stats.authorized.toString()}
            icon={<ShieldCheck size={20} />}
            footerText="Válidas tributariamente"
          />
          <StatCard
            label="Borradores / En Proceso"
            value={stats.draft.toString()}
            icon={<RefreshCw size={20} />}
            footerText="Pendientes de firma"
          />
          <StatCard
            label="Monto Modificado"
            value={formatMoney(stats.grandTotalSum)}
            icon={<CheckCircle2 size={20} />}
            footerText="Total devoluciones"
          />
        </div>

        <SectionCard title="Directorio de Comprobantes 04">
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <OptionGroup
              id="nc-status-filter"
              name="nc-status-filter"
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'Authorized', label: 'Autorizadas' },
                { value: 'Draft', label: 'Borradores' },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              layout="segmented"
              variant="outline"
            />
            <GridDateRangeBox
              from={from}
              to={to}
              lookback={lookback}
              onChange={setRange}
            />
          </div>

          {creditNotes.length === 0 && !loading ? (
            <EmptyState
              icon="receipt"
              title="No hay notas de crédito"
              description="No se encontraron notas de crédito emitidas para el filtro seleccionado."
              action={
                canCreate ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/facturacion/notas-credito/nueva')}
                  >
                    Crear la primera Nota de Crédito
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              dataSource={creditNotes as Record<string, unknown>[]}
              keyExpr="invoiceId"
              columns={columns as unknown as ColumnDef<Record<string, unknown>>[]}
              loading={loading}
              messages={gridMessages}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}
