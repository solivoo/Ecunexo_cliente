import test from 'node:test'
import assert from 'node:assert/strict'
import { pricingToLinePatch } from '../src/pages/facturacion/invoiceFormTypes.ts'

test('precio sin IVA incluido conserva unitario, descuento y tarifa', () => {
  const patch = pricingToLinePatch(
    {
      unitPrice: 90,
      discountAmount: 10,
      taxRate: 0.15,
      pricesIncludeTax: false,
      taxableBase: 90,
    },
    1
  )

  assert.deepEqual(patch, { unitPrice: 90, discount: 10, ivaRate: 15 })
})

test('precio con IVA incluido desagrega la base imponible sin promoción', () => {
  const patch = pricingToLinePatch(
    {
      unitPrice: 115,
      discountAmount: 0,
      taxRate: 0.15,
      pricesIncludeTax: true,
      taxableBase: 100,
    },
    1
  )

  assert.equal(round(patch.unitPrice), 100)
  assert.equal(patch.discount, 0)
  assert.equal(patch.ivaRate, 15)
})

test('precio con IVA incluido expresa la promoción como descuento en base', () => {
  const patch = pricingToLinePatch(
    {
      unitPrice: 115,
      discountAmount: 11.5,
      taxRate: 0.15,
      pricesIncludeTax: true,
      taxableBase: 90,
    },
    1
  )

  assert.equal(round(patch.unitPrice), 100)
  assert.equal(patch.discount, 10)
  const lineNet = round(1 * (patch.unitPrice ?? 0) - (patch.discount ?? 0))
  assert.equal(lineNet, 90)
})

test('precio con IVA incluido y varias unidades cuadra la base', () => {
  const patch = pricingToLinePatch(
    {
      unitPrice: 115,
      discountAmount: 0,
      taxRate: 0.15,
      pricesIncludeTax: true,
      taxableBase: 300,
    },
    3
  )

  assert.equal(round(patch.unitPrice), 100)
  assert.equal(patch.discount, 0)
  const lineNet = round(3 * (patch.unitPrice ?? 0) - (patch.discount ?? 0))
  assert.equal(lineNet, 300)
})

test('tarifa no soportada cae a la tarifa por defecto', () => {
  const patch = pricingToLinePatch(
    {
      unitPrice: 10,
      discountAmount: 0,
      taxRate: 0.12,
      pricesIncludeTax: false,
      taxableBase: 10,
    },
    1
  )

  assert.equal(patch.ivaRate, 15)
})

function round(value: number | undefined): number {
  return Math.round(((value ?? 0) + Number.EPSILON) * 100) / 100
}
