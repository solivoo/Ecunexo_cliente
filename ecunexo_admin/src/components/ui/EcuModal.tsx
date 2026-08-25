import type { ReactNode } from 'react'

export interface EcuModalProps {
  readonly open: boolean
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly footer?: ReactNode
}

export function EcuModal({ open, title, onClose, children, footer }: EcuModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="ecu-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="ecu-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ecu-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ecu-modal__header">
          <h2 id="ecu-modal-title" className="ecu-modal__title">
            {title}
          </h2>
          <button type="button" className="ecu-modal__close" onClick={onClose} aria-label="Cerrar">
            <span className="material-symbols-outlined" aria-hidden>
              close
            </span>
          </button>
        </header>
        <div className="ecu-modal__body">{children}</div>
        {footer ? <footer className="ecu-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  )
}
