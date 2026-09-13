import { useEffect, useState } from 'react'
import { Popup } from 'glubox'
import '@/pages/facturacion/invoiceRidePreview.css'

export type InvoiceRidePreviewPopupProps = {
  readonly open: boolean
  readonly blob: Blob | null
  readonly filename?: string | null
  readonly hint?: string
  readonly printing?: boolean
  readonly environment?: 'test' | 'production' | 'preview'
  readonly onClose: () => void
  readonly onPrint: () => void
}

export function InvoiceRidePreviewPopup({
  open,
  blob,
  filename,
  hint = 'Vista del RIDE.',
  printing = false,
  environment = 'preview',
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
      <div
        className="invoice-ride-preview__top-bar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        {environment === 'production' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.35)',
            }}
          >
            🚀 Producción — Validez Tributaria SRI
          </span>
        ) : environment === 'test' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#b45309',
              border: '1px solid rgba(245, 158, 11, 0.35)',
            }}
          >
            🧪 Ambiente de Pruebas — Sin validez tributaria
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            Previsualización — Sin validez tributaria
          </span>
        )}
        <p className="app-shell__muted invoice-ride-preview__hint" style={{ margin: 0 }}>
          {filename ? (
            <>
              <strong>{filename}</strong>.{' '}
            </>
          ) : null}
          {hint}
        </p>
      </div>
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
