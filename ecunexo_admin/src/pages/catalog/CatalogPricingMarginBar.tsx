export interface ProfitAndMarginResult {
  cost: number | null;
  pvp: number | null;
  profit: number | null;
  marginPct: number | null;
}

export function parsePriceInput(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/**
 * Calcula ganancia ($) y margen de ganancia (%) estilo Shopify:
 * - Ganancia = PVP - Costo
 * - Margen (%) = ((PVP - Costo) / PVP) * 100
 */
export function computeProfitAndMargin(
  costRaw: string | number | null | undefined,
  pvpRaw: string | number | null | undefined,
): ProfitAndMarginResult {
  const cost = parsePriceInput(costRaw);
  const pvp = parsePriceInput(pvpRaw);

  if (cost == null || pvp == null || cost < 0 || pvp < 0) {
    return { cost, pvp, profit: null, marginPct: null };
  }

  const profit = pvp - cost;
  const marginPct = pvp > 0 ? (profit / pvp) * 100 : null;

  return { cost, pvp, profit, marginPct };
}

export interface CatalogPricingMarginBarProps {
  costPrice: string | number | null | undefined;
  basePrice: string | number | null | undefined;
  /** Vista compacta para filas de matriz de variantes o modales reducidos */
  compact?: boolean;
}

export function CatalogPricingMarginBar({
  costPrice,
  basePrice,
  compact = false,
}: CatalogPricingMarginBarProps) {
  const { profit, marginPct } = computeProfitAndMargin(costPrice, basePrice);

  const hasCalculation = profit != null;
  const isPositive = profit != null && profit > 0;
  const isNegative = profit != null && profit < 0;

  const valueColor = !hasCalculation
    ? 'var(--glb-text-secondary)'
    : isPositive
      ? 'var(--glb-success-text, #15803d)'
      : isNegative
        ? 'var(--glb-danger-text, #b91c1c)'
        : 'var(--glb-text)';

  const profitFormatted =
    profit != null ? `${profit < 0 ? '-' : ''}$${Math.abs(profit).toFixed(2)}` : '—';
  const marginFormatted = marginPct != null ? `${marginPct.toFixed(1)}%` : '—';

  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.35rem 0.65rem',
          borderRadius: 'var(--glb-radius-md, 8px)',
          background: 'var(--glb-surface-low, rgba(148, 163, 184, 0.08))',
          border: '1px solid var(--glb-outline-variant, rgba(148, 163, 184, 0.22))',
          fontSize: '0.78rem',
          whiteSpace: 'nowrap',
          height: '36px',
          boxSizing: 'border-box',
        }}
        title="Cálculo referencial: Ganancia = PVP − Precio base (Costo) · Margen = (Ganancia / PVP) × 100. Los clientes no verán esto."
      >
        <span style={{ color: 'var(--glb-text-secondary)' }}>
          Ganancia:{' '}
          <strong style={{ color: valueColor, fontVariantNumeric: 'tabular-nums' }}>
            {profitFormatted}
          </strong>
        </span>
        <span style={{ color: 'var(--glb-outline-variant, #cbd5e1)' }}>|</span>
        <span style={{ color: 'var(--glb-text-secondary)' }}>
          Margen:{' '}
          <strong style={{ color: valueColor, fontVariantNumeric: 'tabular-nums' }}>
            {marginFormatted}
          </strong>
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
        gap: '0.75rem',
        padding: '0.55rem 0.85rem',
        borderRadius: 'var(--glb-radius-md, 10px)',
        background: 'var(--glb-surface-low, rgba(148, 163, 184, 0.08))',
        border: '1px solid var(--glb-outline-variant, rgba(148, 163, 184, 0.22))',
        alignItems: 'center',
      }}
      title="Los clientes no verán el precio base ni el margen de ganancia."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: 'var(--glb-text-secondary)',
          }}
        >
          Ganancia
        </span>
        <span
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: valueColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {profitFormatted}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.1rem',
          borderLeft: '1px solid var(--glb-outline-variant, rgba(148, 163, 184, 0.22))',
          paddingLeft: '0.75rem',
        }}
      >
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: 'var(--glb-text-secondary)',
          }}
        >
          Margen de ganancia
        </span>
        <span
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: valueColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {marginFormatted}
        </span>
      </div>
    </div>
  );
}
