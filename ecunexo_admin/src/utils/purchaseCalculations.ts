export interface LineCalculationItem {
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  subtotal: number
  taxAmount: number
  total: number
}

export function computeLineValues(
  quantity: number,
  unitPrice: number,
  discount: number,
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  const qty = Math.max(0, quantity)
  const price = Math.max(0, unitPrice)
  const disc = Math.max(0, discount)
  const subtotal = Math.round(Math.max(0, qty * price - disc) * 100) / 100
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100
  return { subtotal, taxAmount, total }
}

export function computeInvoiceTotalsFromLines(lines: LineCalculationItem[]): {
  subtotalZero: number
  subtotalTaxed: number
  totalDiscount: number
  taxAmount: number
  totalAmount: number
} {
  let subtotalZero = 0
  let subtotalTaxed = 0
  let totalDiscount = 0
  let taxAmount = 0

  for (const l of lines) {
    if (l.taxRate > 0) {
      subtotalTaxed += l.subtotal
    } else {
      subtotalZero += l.subtotal
    }
    totalDiscount += l.discount
    taxAmount += l.taxAmount
  }

  subtotalZero = Math.round(subtotalZero * 100) / 100
  subtotalTaxed = Math.round(subtotalTaxed * 100) / 100
  totalDiscount = Math.round(totalDiscount * 100) / 100
  taxAmount = Math.round(taxAmount * 100) / 100
  const totalAmount = Math.round((subtotalZero + subtotalTaxed + taxAmount) * 100) / 100

  return { subtotalZero, subtotalTaxed, totalDiscount, taxAmount, totalAmount }
}
