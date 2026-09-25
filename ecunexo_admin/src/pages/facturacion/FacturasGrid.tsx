import { useMemo, useState, type ReactNode } from 'react'
import { DataGrid, Popup, useToast, type ColumnDef } from 'glubox'
import { Ban, Eye, FileCode, FileText, Mail, Send, Trash2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { formatDate } from '@/lib/formatDate'
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
import { sendAuthorizedInvoiceEmail } from '@/pages/facturacion/invoiceEmail'
import { formatMoney } from '@/pages/facturacion/invoiceFormTypes'
import {
  invoiceStateLabel,
  invoiceStateTone,
  sriEnvironmentInfo,
  sriTransmissionLabel,
  sriTransmissionTone,
} from '@/pages/facturacion/invoiceStateLabels'
import { RidePrintConfirmPopup } from '@/pages/facturacion/RidePrintConfirmPopup'
import { VoidInvoicePopup } from '@/pages/facturacion/VoidInvoicePopup'
import { deleteDraftInvoice } from '@/services/billingApi'
import type { InvoiceListItem } from '@/types/billingApi'

export type InvoiceGridRow = InvoiceListItem & {
  readonly environment?: string
} & Record<string, unknown>

export type FacturasGridProps = {
  readonly rows: readonly InvoiceListItem[]
  readonly loading?: boolean
  readonly emitterId: string | null
  readonly onResent?: () => void
  readonly canOperateInvoice?: boolean
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('comprobante', 'comprobantes')

function invoiceStatusClass(tone: ReturnType<typeof invoiceStateTone>): string {
  if (tone === 'success') return 'ecu-status--active'
  if (tone === 'danger') return 'ecu-status--danger'
  if (tone === 'warning' || tone === 'info') return 'ecu-status--warning'
  return 'ecu-status--inactive'
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
    'preview' | 'xml' | 'ride' | 'email' | 'resend' | 'void' | 'delete' | null
  >(null)
  const [ridePrint, setRidePrint] = useState<RidePdfResult | null>(null)
  const [previewRide, setPreviewRide] = useState<RidePdfResult | null>(null)
  const [previewRow, setPreviewRow] = useState<InvoiceListItem | null>(null)
  const [printing, setPrinting] = useState(false)
  const [voidTarget, setVoidTarget] = useState<InvoiceListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null)

  const columns = useMemo((): ColumnDef<InvoiceGridRow>[] => {
    return [
      {
        key: 'issueDate',
        header: 'Fecha',
        width: 110,
        sortable: true,
        renderCell: (_v, row) => formatDate(row.issueDate),
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
        width: 120,
        sortable: true,
        renderCell: (_v, row) => <code className="ecu-code">{row.sequential}</code>,
      },
      {
        key: 'documentType',
        header: 'Tipo',
        width: 80,
        sortable: true,
        renderCell: (_v, row) => (
          <span className="ecu-chip">{row.documentType === '04' ? 'NC' : 'Factura'}</span>
        ),
      },
      {
        key: 'counterpartyName',
        header: 'Cliente',
        width: 180,
        sortable: true,
        renderCell: (_v, row) => (
          <strong className="ecu-clip" title={row.counterpartyName}>
            {row.counterpartyName}
          </strong>
        ),
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
          <span
            className={`ecu-status ${invoiceStatusClass(
              row.isVoided ? 'warning' : invoiceStateTone(row.state)
            )}`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {row.isVoided ? 'Anulada' : invoiceStateLabel(row.state)}
          </span>
        ),
      },
      {
        key: 'sriTransmissionState',
        header: 'SRI',
        width: 130,
        sortable: true,
        renderCell: (_v, row) => (
          <span
            className={`ecu-status ${invoiceStatusClass(
              sriTransmissionTone(row.sriTransmissionState)
            )}`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {sriTransmissionLabel(row.sriTransmissionState)}
          </span>
        ),
      },
      {
        key: 'environment',
        header: 'Ambiente',
        width: 155,
        sortable: true,
        renderCell: (_v, row) => {
          const env = sriEnvironmentInfo(row.accessKey)
          return (
            <span className="ecu-chip" title={env.tooltip}>
              {env.label}
            </span>
          )
        },
      },
      {
        key: 'invoiceId',
        header: 'Acciones',
        sticky: 'right',
        width: canOperateInvoice ? 240 : 132,
        align: 'center',
        sortable: false,
        renderCell: (_v, row) => {
          const busy = busyId === row.invoiceId
          const canResend = Boolean(canOperateInvoice && row.canResend && emitterId)
          const canVoid = Boolean(canOperateInvoice && row.canVoid && emitterId)
          const canEmail = Boolean(
            canOperateInvoice &&
              emitterId &&
              row.state === 'Authorized' &&
              !row.isVoided &&
              row.documentType !== '04'
          )
          const isDraft = row.state === 'Draft'
          const resendTitle = !canOperateInvoice
            ? 'Se requiere permiso para emitir (facturacion.facturas.create)'
            : row.canResend
              ? isDraft
                ? 'Enviar borrador al SRI (firmar y transmitir)'
                : 'Reenviar al SRI (siguiente en secuencia)'
              : 'Solo el comprobante pendiente con el secuencial más bajo puede enviarse al SRI'
          const resendLabel = isDraft ? 'Enviar al SRI' : 'Reenviar al SRI'
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
                  setPreviewRow(row)
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
                  label="Reenviar correo al cliente"
                  icon={Mail}
                  disabled={busy || !canEmail}
                  loading={busy && busyAction === 'email'}
                  title={
                    canEmail
                      ? 'Enviar RIDE PDF y XML al correo del cliente'
                      : 'Solo facturas autorizadas con correo del cliente'
                  }
                  onClick={() => {
                    if (!emitterId || !canEmail) return
                    setBusyId(row.invoiceId)
                    setBusyAction('email')
                    void sendAuthorizedInvoiceEmail({ emitterId, invoiceId: row.invoiceId })
                      .then((r) => {
                        toast.show({
                          title: 'Correo enviado',
                          message: `RIDE y XML enviados a ${r.to}.`,
                          variant: 'success',
                        })
                      })
                      .catch((err: unknown) => {
                        toast.show({
                          title: 'Correo al cliente',
                          message: readApiError(
                            err,
                            'No se pudo enviar el correo con RIDE y XML.'
                          ),
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
                  label={resendLabel}
                  icon={Send}
                  disabled={busy || !canResend}
                  loading={busy && busyAction === 'resend'}
                  title={resendTitle}
                  onClick={() => {
                    if (!emitterId || !canResend) return
                    setBusyId(row.invoiceId)
                    setBusyAction('resend')
                    const rowEnv =
                      row.accessKey && row.accessKey.length >= 24
                        ? row.accessKey[23] === '2'
                          ? 'Production'
                          : 'Test'
                        : null
                    void resendInvoiceAndWait(emitterId, row.invoiceId, {
                      sequentialHint: row.sequential,
                      environment: rowEnv,
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
                        if (r.emailStatus === 'failed') {
                          toast.show({
                            title: 'Correo al cliente',
                            message:
                              'La factura se autorizó, pero no se pudo enviar el correo con RIDE y XML.',
                            variant: 'warning',
                          })
                        }
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
              {canOperateInvoice && isDraft ? (
                <GridIconButton
                  label="Eliminar borrador"
                  icon={Trash2}
                  disabled={busy || !emitterId}
                  loading={busy && busyAction === 'delete'}
                  title="Eliminar borrador de factura (no emitida al SRI)"
                  onClick={() => setDeleteTarget(row)}
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
    const targetEnv =
      target.accessKey && target.accessKey.length >= 24
        ? target.accessKey[23] === '2'
          ? 'Production'
          : 'Test'
        : null
    void voidInvoiceAndWait(emitterId, target.invoiceId, motivo, null, targetEnv)
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

  const onConfirmDelete = () => {
    if (!deleteTarget || !emitterId || busyAction === 'delete') return
    const target = deleteTarget
    setBusyId(target.invoiceId)
    setBusyAction('delete')
    void deleteDraftInvoice(emitterId, target.invoiceId)
      .then(() => {
        toast.show({
          title: 'Borrador eliminado',
          message: 'El borrador de la factura fue eliminado correctamente.',
          variant: 'success',
        })
        setDeleteTarget(null)
        onResent?.()
      })
      .catch((err: unknown) => {
        toast.show({
          title: 'Eliminar borrador',
          message: readApiError(err, 'No se pudo eliminar el borrador.'),
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
        hint={
          previewRow && previewRow.accessKey && previewRow.accessKey.length >= 24 && previewRow.accessKey[23] === '1'
            ? 'Comprobante emitido en ambiente de pruebas (celcer.sri.gob.ec). No genera crédito fiscal.'
            : 'Vista del RIDE emitido.'
        }
        environment={
          previewRow?.accessKey && previewRow.accessKey.length >= 24
            ? previewRow.accessKey[23] === '2'
              ? 'production'
              : 'test'
            : 'preview'
        }
        printing={printing && previewRide !== null}
        onClose={() => {
          if (!printing) {
            setPreviewRide(null)
            setPreviewRow(null)
          }
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
      <Popup
        open={deleteTarget !== null}
        title="Eliminar borrador de factura"
        onClose={() => {
          if (busyAction !== 'delete') setDeleteTarget(null)
        }}
        width="min(92vw, 26rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'secondary',
            onClick: () => setDeleteTarget(null),
            disabled: busyAction === 'delete',
          },
          {
            id: 'confirm',
            label: busyAction === 'delete' ? 'Eliminando…' : 'Eliminar borrador',
            variant: 'danger',
            onClick: onConfirmDelete,
            disabled: busyAction === 'delete',
          },
        ]}
      >
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--glb-text)', lineHeight: 1.5 }}>
          ¿Está seguro de eliminar este borrador de factura para el cliente{' '}
          <strong>{deleteTarget?.counterpartyName}</strong> por un total de{' '}
          <strong>{formatMoney(deleteTarget?.grandTotal ?? 0)}</strong>? Esta acción borrará el registro de la base de datos y no se podrá deshacer.
        </p>
      </Popup>
    </>
  )
}
