import {
  formatIsoDate,
  SRI_ONLINE_VOID_CODE,
  summarizeVersion,
  type CreateTaxRuleBody,
  type TaxRuleKind,
} from '@/pages/facturacion/taxRuleCatalog'
import { TaxRulesNewVersionForm } from '@/pages/facturacion/TaxRulesNewVersionForm'

type TaxRuleKindCardProps = {
  readonly kind: TaxRuleKind
  readonly canWrite: boolean
  readonly busy: boolean
  readonly onSubmit: (body: CreateTaxRuleBody) => void
}

export function TaxRuleKindCard({ kind, canWrite, busy, onSubmit }: TaxRuleKindCardProps) {
  const current = kind.current
  const canRegisterVoid = canWrite && kind.code === SRI_ONLINE_VOID_CODE

  return (
    <article className="app-shell__card ecu-companies-form__card tax-rule-kind">
      <header className="tax-rule-kind__header">
        <div>
          <h2 className="app-shell__section-title">{kind.title}</h2>
          <p className="tax-rule-kind__code">{kind.code}</p>
        </div>
        <p className="tax-rule-kind__badge">
          {current ? `Vigente desde ${formatIsoDate(current.validFrom)}` : 'Sin vigencia actual'}
        </p>
      </header>

      <p className="tax-rule-kind__summary">
        {current ? summarizeVersion(current) : 'No hay una vigencia activa para hoy.'}
      </p>

      <details className="tax-rule-kind__details">
        <summary>Historial ({kind.versions.length})</summary>
        <ol className="tax-rule-kind__timeline">
          {kind.versions.map((row) => {
            const isCurrent = current?.validFrom === row.validFrom && current.validTo === row.validTo
            return (
              <li
                key={`${row.code}-${row.validFrom}`}
                className={
                  isCurrent ? 'tax-rule-kind__version tax-rule-kind__version--current' : 'tax-rule-kind__version'
                }
              >
                <p className="tax-rule-kind__when">
                  {formatIsoDate(row.validFrom)}
                  {' → '}
                  {row.validTo ? formatIsoDate(row.validTo) : 'sigue vigente'}
                </p>
                <p className="tax-rule-kind__version-text">{summarizeVersion(row)}</p>
                <p className="tax-rule-kind__version-desc">{row.description}</p>
              </li>
            )
          })}
        </ol>
      </details>

      {canRegisterVoid ? (
        <details className="tax-rule-kind__details">
          <summary>Registrar nueva vigencia</summary>
          <TaxRulesNewVersionForm disabled={false} busy={busy} onSubmit={onSubmit} />
        </details>
      ) : null}
    </article>
  )
}
