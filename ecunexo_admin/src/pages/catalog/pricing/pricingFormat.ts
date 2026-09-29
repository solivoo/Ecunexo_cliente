import { PromotionTargetType, PromotionType, VolumeDiscountSchemeType } from '@/types/pricingApi'

const moneyFormatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return moneyFormatter.format(value)
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00Z`).toISOString()
}

export function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59Z`).toISOString()
}

export function promotionTypeLabel(type: PromotionType): string {
  if (type === PromotionType.Percentage) return 'Porcentaje'
  if (type === PromotionType.FixedAmount) return 'Valor fijo'
  return 'Precio fijo'
}

export function promotionTargetTypeLabel(type: PromotionTargetType): string {
  if (type === PromotionTargetType.AllItems) return 'Toda la tienda'
  if (type === PromotionTargetType.Variant) return 'Variante'
  return 'Producto'
}

export function promotionValueLabel(type: PromotionType, value: number): string {
  if (type === PromotionType.Percentage) return `${value}%`
  return formatMoney(value)
}

export function isVigentOn(validFrom: string, validTo: string | null, date: string): boolean {
  return validFrom <= date && (validTo === null || validTo >= date)
}

export function volumeSchemeTypeLabel(type: VolumeDiscountSchemeType): string {
  if (type === VolumeDiscountSchemeType.Percentage) return 'Porcentaje (%)'
  if (type === VolumeDiscountSchemeType.FixedAmount) return 'Descuento fijo ($)'
  return 'Precio unitario fijo ($)'
}

export function formatVolumeTiersSummary(
  type: VolumeDiscountSchemeType,
  tiers: { quantityFrom: number; quantityTo: number | null; value: number }[]
): string {
  if (!tiers || tiers.length === 0) return 'Sin tramos definidos'
  const sorted = [...tiers].sort((a, b) => a.quantityFrom - b.quantityFrom)
  return sorted
    .map((t) => {
      const range = t.quantityTo ? `${t.quantityFrom}–${t.quantityTo} un.` : `≥${t.quantityFrom} un.`
      const val = type === VolumeDiscountSchemeType.Percentage ? `${t.value}%` : formatMoney(t.value)
      return `${range}: -${val}`
    })
    .join(' | ')
}

