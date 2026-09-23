import type { VariantAdminSummary } from '@/lib/catalogArchetype'

export type VariantAdminSummaryBlockProps = {
  readonly summary: VariantAdminSummary
  readonly label?: string
}

export function VariantAdminSummaryBlock({ summary, label = 'Variante' }: VariantAdminSummaryBlockProps) {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>
        {label}: <code className="ecu-code">{summary.sku}</code>
      </div>
      {summary.axisLines.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.35rem',
            marginTop: '0.45rem',
          }}
        >
          {summary.axisLines.map((line) => (
            <span
              key={line.name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.12rem 0.45rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 600,
                border: '1px solid var(--shell-border, rgba(0,0,0,0.12))',
                background: 'var(--glb-surface-variant, rgba(0,0,0,0.03))',
              }}
            >
              <span style={{ opacity: 0.7, fontWeight: 500 }}>{line.name}:</span>
              {line.isColor ? (
                <span
                  title={line.value}
                  aria-label={`Color ${line.value}`}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '1px solid rgba(148,163,184,0.55)',
                    backgroundColor: line.value,
                  }}
                />
              ) : (
                line.value
              )}
            </span>
          ))}
        </div>
      ) : summary.fallbackLabel !== '—' ? (
        <div style={{ marginTop: '0.35rem', fontSize: '0.82rem' }}>{summary.fallbackLabel}</div>
      ) : null}
    </div>
  )
}
