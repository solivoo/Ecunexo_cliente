export type SriConfigAsideProps = {
  readonly progressPercent: number
  readonly statusLabel: string
  readonly emitProfileLabel: string
  readonly emitProfileIsDev: boolean
}

export function SriConfigAside({
  progressPercent,
  statusLabel,
  emitProfileLabel,
  emitProfileIsDev,
}: SriConfigAsideProps) {
  return (
    <aside className="sri-config-page__aside">
      <div className="sri-config-status">
        <p className="sri-config-status__label">Estado del SRI</p>
        <p className="sri-config-status__value">{statusLabel}</p>
        <div
          className="sri-config-status__bar"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de configuración SRI"
        >
          <div
            className="sri-config-status__bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="sri-config-status__hint">
          {progressPercent >= 100
            ? 'Listo para facturar electrónicamente.'
            : 'Faltan completar las secciones para facturar'}
        </p>
      </div>

      <div
        className={
          emitProfileIsDev
            ? 'sri-config-mode-badge sri-config-mode-badge--dev'
            : 'sri-config-mode-badge sri-config-mode-badge--prod'
        }
      >
        <p className="sri-config-mode-badge__label">Modo de emisión</p>
        <p className="sri-config-mode-badge__value">{emitProfileLabel}</p>
      </div>

      <div className="sri-config-tips">
        <h3 className="sri-config-tips__title">Consejos útiles</h3>
        <ul className="sri-config-tips__list">
          <li>Asegúrate que tu firma esté vigente</li>
          <li>El RUC debe coincidir exactamente con tu certificado digital</li>
          <li>El RUC Proveedor es el de quien vende el software (EcuNexo), no el del cliente</li>
          <li>Usar primero «Desarrollo — SRI pruebas» antes de producción</li>
        </ul>
      </div>
    </aside>
  )
}
