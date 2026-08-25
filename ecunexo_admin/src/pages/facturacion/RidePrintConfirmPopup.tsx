import { Popup } from 'glubox'

export type RidePrintConfirmPopupProps = {
  readonly open: boolean
  readonly filename?: string | null
  /** Texto del cuerpo; si se omite, usa el mensaje por defecto tras generar. */
  readonly message?: string
  readonly printing?: boolean
  readonly onClose: () => void
  readonly onConfirmPrint: () => void
}

/** Pregunta si se desea imprimir el RIDE tras generarlo. */
export function RidePrintConfirmPopup({
  open,
  filename,
  message,
  printing = false,
  onClose,
  onConfirmPrint,
}: RidePrintConfirmPopupProps) {

  return (
    <Popup
      open={open}
      title="Imprimir RIDE"
      onClose={onClose}
      width="min(92vw, 28rem)"
      closeOnOverlayClick={!printing}
      closeOnEscape={!printing}
      actions={[
        {
          id: 'skip',
          label: 'Ahora no',
          variant: 'ghost',
          onClick: onClose,
          disabled: printing,
        },
        {
          id: 'print',
          label: printing ? 'Preparando…' : 'Sí, imprimir',
          variant: 'primary',
          onClick: onConfirmPrint,
          disabled: printing,
          loading: printing,
        },
      ]}
    >
      <p className="app-shell__muted">
        {message ?? (
          <>
            El RIDE se generó correctamente
            {filename ? (
              <>
                {' '}
                (<strong>{filename}</strong>)
              </>
            ) : null}
            . ¿Desea imprimirlo ahora?
          </>
        )}
      </p>
    </Popup>
  )
}
