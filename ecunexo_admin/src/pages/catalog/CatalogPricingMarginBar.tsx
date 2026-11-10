import { TextBox } from 'glubox'

export interface ProfitAndMarginResult {
  cost: number | null
  pvp: number | null
  profit: number | null
  marginPct: number | null
}

export function parsePriceInput(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
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
  const cost = parsePriceInput(costRaw)
  const pvp = parsePriceInput(pvpRaw)

  if (cost == null || pvp == null || cost < 0 || pvp < 0) {
    return { cost, pvp, profit: null, marginPct: null }
  }

  const profit = pvp - cost
  const marginPct = pvp > 0 ? (profit / pvp) * 100 : null

  return { cost, pvp, profit, marginPct }
}

export interface CatalogPricingMarginBarProps {
  costPrice: string | number | null | undefined
  basePrice: string | number | null | undefined
  /** Vista compacta para filas de matriz de variantes o modales reducidos */
  compact?: boolean
}

export function CatalogPricingMarginBar({
  costPrice,
  basePrice,
  compact = false,
}: CatalogPricingMarginBarProps) {
  const { profit, marginPct } = computeProfitAndMargin(costPrice, basePrice)

  const profitFormatted =
    profit != null ? `${profit < 0 ? '-' : ''}$${Math.abs(profit).toFixed(2)}` : '—'
  const marginFormatted = marginPct != null ? `${marginPct.toFixed(1)}%` : '—'

  const hint =
    'Cálculo referencial: Ganancia = PVP − Costo · Margen = (Ganancia / PVP) × 100. Los clientes no verán esto.'

  if (compact) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.5rem',
          width: '100%',
        }}
        title={hint}
      >
        <TextBox
          label="Ganancia"
          labelPosition="outlined"
          variant="outline"
          size="sm"
          value={profitFormatted}
          readOnly
          fullWidth
        />
        <TextBox
          label="Margen"
          labelPosition="outlined"
          variant="outline"
          size="sm"
          value={marginFormatted}
          readOnly
          fullWidth
        />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '0.75rem',
        width: '100%',
      }}
      title={hint}
    >
      <TextBox
        label="Ganancia"
        labelPosition="outlined"
        variant="outline"
        value={profitFormatted}
        readOnly
        fullWidth
      />
      <TextBox
        label="Margen de ganancia"
        labelPosition="outlined"
        variant="outline"
        value={marginFormatted}
        readOnly
        fullWidth
      />
    </div>
  )
}
