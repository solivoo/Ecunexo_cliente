import { useMemo, useState, type ReactNode } from 'react'
import { DataGrid, useToast, type ColumnDef } from 'glubox'
import { Ban, Eye, FileCode, FileText, Send } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  buildInvoiceRidePdf,
  downloadInvoiceRide,
  downloadInvoiceXml,
  printPdfBlob,
  type RidePdfResult,
} from '@/pages/facturacion/invoiceDownloads'
import { InvoiceRidePreviewPopup } from '@/pages/facturacion/InvoiceRidePreviewPopup'
import { resendInvoiceAndWait, voidInvoiceAndWait } from '@/pages/facturacion/invoiceEmitApi'
import { formatMoney } from '@/pages/facturacion/invoiceFormTypes'
import {
  invoiceStateLabel,
  invoiceStateTone,
  sriTransmissionLabel,
  sriTransmissionTone,
} from '@/pages/facturacion/invoiceStateLabels'
import { RidePrintConfirmPopup } from '@/pages/facturacion/RidePrintConfirmPopup'
import { VoidInvoicePopup } from '@/pages/facturacion/VoidInvoicePopup'
import type { InvoiceListItem } from '@/types/billingApi'

export type InvoiceGridRow = InvoiceListItem & Record<string, unknown>

export type FacturasGridProps = {
  readonly rows: readonly InvoiceListItem[]
  readonly loading?: boolean
  readonly emitterId: string | null
  readonly onResent?: () => void
  readonly canOperateInvoice?: boolean
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('comprobante', 'comprobantes')

function StatusBadge({
  label,
  tone,
}: {
  readonly label: string
  readonly tone: ReturnType<typeof invoiceStateTone>
}) {
  return <span className={`ecu-invoice-status ecu-invoice-status--${tone}`}>{label}</span>
}

export function FacturasGrid({
  rows,
  loading = false,
  emitterId,
  onResent,
  canOperateInvoice = false,
  toolbarRight,
}: FacturasGridProps) {
  const toast = useToast()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<
    'preview' | 'xml' | 'ride' | 'resend' | 'void' | null
  >(null)
  const [ridePrint, setRidePrint] = useState<RidePdfResult | null>(null)
  const [previewRide, setPreviewRide] = useState<RidePdfResult | null>(null)
  const [printing, setPrinting] = useState(false)
  const [voidTarget, setVoidTarget] = useState<InvoiceListItem | null>(null)

  const columns = useMemo((): ColumnDef<InvoiceGridRow>[] => {
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
        sortable: true,
      },
      {
        key: 'emissionPoint',
        header: 'Pto.',
        width: 70,
        sortable: true,
      },
      {
        key: 'sequential',
        header: 'Secuencial',
        width: 110,
        sortable: true,
      },
      {
        key: 'documentType',
        header: 'Tipo',
        width: 70,
        sortable: true,
        renderCell: (_v, row) => (row.documentType === '04' ? 'NC' : 'Factura'),
      },
      {
        key: 'counterpartyName',
        header: 'Cliente',
        width: 180,
        sortable: true,
        renderCell: (_v, row) => <strong>{row.counterpartyName}</strong>,
      },
      {
        key: 'grandTotal',
        header: 'Total',
        width: 100,
        align: 'right',
        sortable: true,
        renderCell: (_v, row) => formatMoney(row.grandTotal),
      },
      {
        key: 'state',
        header: 'Estado',
        width: 130,
        sortable: true,
        renderCell: (_v, row) => (
          <StatusBadge
            label={row.isVoided ? 'Anulada' : invoiceStateLabel(row.state)}
            tone={row.isVoided ? 'warning' : invoiceStateTone(row.state)}
          />
        ),
      },
      {
        key: 'sriTransmissionState',
        header: 'SRI',
        width: 120,
        sortable: true,
        renderCell: (_v, row) => (
          <StatusBadge
            label={sriTransmissionLabel(row.sriTransmissionState)}
            tone={sriTransmissionTone(row.sriTransmissionState)}
          />
        ),
      },
      {
        key: 'invoiceId',
        header: 'Acciones',
        width: canOperateInvoice ? 200 : 132,
        align: 'center',
        sortable: false,
        renderCell: (_v, row) => {
          const busy = busyId === row.invoiceId
          const canResend = Boolean(canOperateInvoice && row.canResend && emitterId)
          const canVoid = Boolean(canOperateInvoice && row.canVoid && emitterId)
          const resendTitle = !canOperateInvoice
            ? 'Se requiere permiso para emitir (facturacion.facturas.create)'
            : row.canResend
              ? 'Reenviar al SRI (siguiente en secuencia)'
              : 'Solo el comprobante pendiente con el secuencial más bajo puede reenviarse'
          return (
            <div className="ecu-companies-grid__actions">
              <GridIconButton
                label="Previsualizar"
                icon={Eye}
                disabled={busy || !emitterId}
                loading={busy && busyAction === 'preview'}
                onClick={() => {
                  if (!emitterId) return
                  setBusyId(row.invoiceId)
                  setBusyAction('preview')
                  void buildInvoiceRidePdf(emitterId, row.invoiceId)
                    .then((r) => setPreviewRide(r))
                    .catch((err: unknown) => {
                      toast.show({
                        title: 'Previsualizar',
                        message: readApiError(err, 'No se pudo generar la vista previa.'),
                        variant: 'error',
                      })
                    })
                    .finally(() => {
                      setBusyId(null)
                      setBusyAction(null)
                    })
                }}
              />
              <GridIconButton
                label="Descargar XML"
                icon={FileCode}
                disabled={busy || !emitterId}
                loading={busy && busyAction === 'xml'}
                onClick={() => {
                  if (!emitterId) return
                  setBusyId(row.invoiceId)
                  setBusyAction('xml')
                  void downloadInvoiceXml(emitterId, row.invoiceId)
                    .then((r) => {
                      toast.show({
                        title: 'XML descargado',
                        message: `${r.filename} (${r.source}).`,
                        variant: 'success',
                      })
                    })
                    .catch((err: unknown) => {
                      toast.show({
                        title: 'XML',
                        message: readApiError(err, 'No se pudo generar el XML.'),
                        variant: 'error',
                      })
                    })
                    .finally(() => {
                      setBusyId(null)
                      setBusyAction(null)
                    })
                }}
              />
              <GridIconButton
                label="Generar RIDE"
                icon={FileText}
                disabled={busy || !emitterId}
                loading={busy && busyAction === 'ride'}
                onClick={() => {
                  if (!emitterId) return
                  setBusyId(row.invoiceId)
                  setBusyAction('ride')
                  void downloadInvoiceRide(emitterId, row.invoiceId)
                    .then((r) => {
                      toast.show({
                        title: 'RIDE generado',
                        message: r.filename,
                        variant: 'success',
                      })
                      setRidePrint(r)
                    })
                    .catch((err: unknown) => {
                      toast.show({
                        title: 'RIDE',
                        message: readApiError(err, 'No se pudo generar el RIDE PDF.'),
                        variant: 'error',
                      })
                    })
                    .finally(() => {
                      setBusyId(null)
                      setBusyAction(null)
                    })
                }}
              />
              {canOperateInvoice ? (
                <GridIconButton
                  label="Reenviar al SRI"
                  icon={Send}
                  disabled={busy || !canResend}
                  loading={busy && busyAction === 'resend'}
                  title={resendTitle}
                  onClick={() => {
                    if (!emitterId || !canResend) return
                    setBusyId(row.invoiceId)
                    setBusyAction('resend')
                    void resendInvoiceAndWait(emitterId, row.invoiceId, {
                      sequentialHint: row.sequential,
                    })
                      .then((r) => {
                        toast.show({
                          title:
                            r.outcome === 'success'
                              ? 'Autorizada por el SRI'
                              : r.outcome === 'warning'
                                ? 'Reenvío en proceso'
                                : 'SRI no aceptó el reenvío',
                          message: r.message,
                          variant:
                            r.outcome === 'success'
                              ? 'success'
                              : r.outcome === 'warning'
                                ? 'warning'
                                : 'error',
                        })
                        onResent?.()
                      })
                      .catch((err: unknown) => {
                        toast.show({
                          title: 'Reenviar',
                          message: readApiError(err, 'No se pudo reenviar al SRI.'),
                          variant: 'error',
                        })
                      })
                      .finally(() => {
                        setBusyId(null)
                        setBusyAction(null)
                      })
                  }}
                />
              ) : null}
              {canOperateInvoice ? (
                <GridIconButton
                  label="Anular con nota de crédito"
                  icon={Ban}
                  disabled={busy || !canVoid}
                  loading={busy && busyAction === 'void'}
                  title={
                    canVoid
                      ? 'Emitir nota de crédito por el total'
                      : 'Solo una factura autorizada sin NC vigente se puede anular'
                  }
                  onClick={() => {
                    if (!canVoid) return
                    setVoidTarget(row)
                  }}
                />
              ) : null}
            </div>
          )
        },
      },
    ]
  }, [busyAction, busyId, canOperateInvoice, emitterId, onResent, toast])

  const dataSource = useMemo(
    () => (Array.isArray(rows) ? [...rows] : []) as InvoiceGridRow[],
    [rows]
  )

  const onConfirmPrint = () => {
    if (!ridePrint || printing) return
    setPrinting(true)
    void printPdfBlob(ridePrint.blob)
      .then(() => {
        toast.show({
          title: 'Impresión',
          message: 'Se abrió el diálogo de impresión del RIDE.',
          variant: 'success',
        })
        setRidePrint(null)
      })
      .catch((err: unknown) => {
        toast.show({
          title: 'Impresión',
          message: readApiError(err, 'No se pudo imprimir el RIDE.'),
          variant: 'error',
        })
      })
      .finally(() => setPrinting(false))
  }

  const onConfirmVoid = (motivo: string) => {
    if (!voidTarget || !emitterId || busyAction === 'void') return
    const target = voidTarget
    setBusyId(target.invoiceId)
    setBusyAction('void')
    void voidInvoiceAndWait(emitterId, target.invoiceId, motivo)
      .then((r) => {
        toast.show({
          title:
            r.outcome === 'success'
              ? 'Factura anulada'
              : r.outcome === 'warning'
                ? 'Nota de crédito en proceso'
                : 'SRI no aceptó la nota de crédito',
          message: r.message,
          variant:
            r.outcome === 'success' ? 'success' : r.outcome === 'warning' ? 'warning' : 'error',
        })
        setVoidTarget(null)
        onResent?.()
      })
      .catch((err: unknown) => {
        toast.show({
          title: 'Anular',
          message: readApiError(err, 'No se pudo emitir la nota de crédito.'),
          variant: 'error',
        })
      })
      .finally(() => {
        setBusyId(null)
        setBusyAction(null)
      })
  }

  return (
    <>
      <DataGrid
        className="ecu-companies-grid"
        dataSource={dataSource}
        keyExpr="invoiceId"
        columns={columns}
        selectionMode="none"
        showSearch
        searchPosition="left"
        searchWidth={280}
        searchPlaceholder="Buscar cliente o secuencial…"
        toolbarRight={toolbarRight}
        paging={paging}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        paginationMode="client"
        pageSizeOptions={pageSizeOptions}
        layout="auto"
        cardBreakpoint={720}
        virtualized
        virtualThreshold={40}
        showRowCount
        fullWidth
        loading={loading}
        messages={gridMessages}
        stickyFirstColumn
      />
      <InvoiceRidePreviewPopup
        open={previewRide !== null}
        blob={previewRide?.blob ?? null}
        filename={previewRide?.filename}
        hint="Vista del RIDE emitido."
        printing={printing && previewRide !== null}
        onClose={() => {
          if (!printing) setPreviewRide(null)
        }}
        onPrint={() => {
          if (!previewRide || printing) return
          setPrinting(true)
          void printPdfBlob(previewRide.blob)
            .then(() => {
              toast.show({
                title: 'Impresión',
                message: 'Se abrió el diálogo de impresión del RIDE.',
                variant: 'success',
              })
            })
            .catch((err: unknown) => {
              toast.show({
                title: 'Impresión',
                message: readApiError(err, 'No se pudo imprimir el RIDE.'),
                variant: 'error',
              })
            })
            .finally(() => setPrinting(false))
        }}
      />
      <RidePrintConfirmPopup
        open={ridePrint !== null}
        filename={ridePrint?.filename}
        printing={printing}
        onClose={() => {
          if (!printing) setRidePrint(null)
        }}
        onConfirmPrint={onConfirmPrint}
      />
      <VoidInvoicePopup
        invoice={voidTarget}
        submitting={busyAction === 'void'}
        onClose={() => {
          if (busyAction !== 'void') setVoidTarget(null)
        }}
        onConfirm={onConfirmVoid}
      />
    </>
  )
}
