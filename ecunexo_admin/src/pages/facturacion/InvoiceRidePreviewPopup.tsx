import { useEffect, useState } from 'react'
import { Popup } from 'glubox'
import '@/pages/facturacion/invoiceRidePreview.css'

export type InvoiceRidePreviewPopupProps = {
  readonly open: boolean
  readonly blob: Blob | null
  readonly filename?: string | null
  readonly hint?: string
  readonly printing?: boolean
  readonly onClose: () => void
  readonly onPrint: () => void
}

export function InvoiceRidePreviewPopup({
  open,
  blob,
  filename,
  hint = 'Vista del RIDE.',
  printing = false,
  onClose,
  onPrint,
}: InvoiceRidePreviewPopupProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])

  return (
    <Popup
      open={open}
      title="Previsualizar factura"
      onClose={onClose}
      width="min(96vw, 56rem)"
      closeOnOverlayClick={!printing}
      closeOnEscape={!printing}
      actions={[
        {
          id: 'close',
          label: 'Cerrar',
          variant: 'ghost',
          onClick: onClose,
          disabled: printing,
        },
        {
          id: 'print',
          label: printing ? 'Preparando…' : 'Imprimir',
          variant: 'primary',
          onClick: onPrint,
          disabled: printing || !blob,
          loading: printing,
        },
      ]}
    >
      <p className="app-shell__muted invoice-ride-preview__hint">
        {filename ? (
          <>
            <strong>{filename}</strong>.{' '}
          </>
        ) : null}
        {hint}
      </p>
      {url ? (
        <iframe
          className="invoice-ride-preview__frame"
          title="Previsualización del RIDE"
          src={url}
        />
      ) : (
        <p className="app-shell__muted">Generando vista previa…</p>
      )}
    </Popup>
  )
}
