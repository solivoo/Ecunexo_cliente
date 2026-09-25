import test from 'node:test'
import assert from 'node:assert/strict'
import { formatVariantDisplayName } from '../src/lib/catalogArchetype.ts'

type LineDraft = { catalogItemId: string; quantity: string }

function mergeLinesFromModal(
  currentLines: LineDraft[],
  incoming: { catalogItemId: string; quantity: number }[]
): LineDraft[] {
  let updated = [...currentLines]
  if (updated.length === 1 && !updated[0].catalogItemId) {
    updated = []
  }
  for (const item of incoming) {
    const existingIdx = updated.findIndex((l) => l.catalogItemId === item.catalogItemId)
    if (existingIdx >= 0) {
      const cur = Number(updated[existingIdx].quantity) || 0
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: String(cur + item.quantity),
      }
    } else {
      updated.push({
        catalogItemId: item.catalogItemId,
        quantity: String(item.quantity),
      })
    }
  }
  return updated
}

function matchItemByBarcodeOrSku(
  code: string,
  catalog: {
    id: string
    isMatrixParent: boolean
    kind: number
    sku: string | null
    customAttributesJson?: string | null
  }[]
) {
  const query = code.trim().toLowerCase()
  if (!query) return null

  return (
    catalog.find((c) => {
      if (c.isMatrixParent || c.kind !== 0) return false
      if (c.sku && c.sku.toLowerCase() === query) return true
      if (c.customAttributesJson) {
        try {
          const attrs = JSON.parse(c.customAttributesJson) as Record<string, unknown>
          if (attrs && typeof attrs === 'object') {
            const barcode = attrs.barcode || attrs.codigo_barras || attrs.ean
            if (barcode && String(barcode).toLowerCase() === query) return true
          }
        } catch {
          // ignore
        }
      }
      return false
    }) ?? null
  )
}

test('Merge de líneas desde modal — Reemplaza primera línea vacía', () => {
  const initial: LineDraft[] = [{ catalogItemId: '', quantity: '1' }]
  const incoming = [
    { catalogItemId: 'item-1', quantity: 5 },
    { catalogItemId: 'item-2', quantity: 10 },
  ]
  const result = mergeLinesFromModal(initial, incoming)
  assert.equal(result.length, 2)
  assert.deepEqual(result, [
    { catalogItemId: 'item-1', quantity: '5' },
    { catalogItemId: 'item-2', quantity: '10' },
  ])
})

test('Merge de líneas desde modal — Suma cantidad si el ítem ya existe', () => {
  const initial: LineDraft[] = [
    { catalogItemId: 'item-1', quantity: '5' },
    { catalogItemId: 'item-3', quantity: '2' },
  ]
  const incoming = [
    { catalogItemId: 'item-1', quantity: 3 },
    { catalogItemId: 'item-4', quantity: 8 },
  ]
  const result = mergeLinesFromModal(initial, incoming)
  assert.equal(result.length, 3)
  assert.deepEqual(result, [
    { catalogItemId: 'item-1', quantity: '8' },
    { catalogItemId: 'item-3', quantity: '2' },
    { catalogItemId: 'item-4', quantity: '8' },
  ])
})

test('Escáner — Encuentra ítem por SKU exacto e insensible a mayúsculas', () => {
  const catalog = [
    { id: 'parent-1', isMatrixParent: true, kind: 0, sku: 'PADRE' },
    { id: 'var-1', isMatrixParent: false, kind: 0, sku: 'CALC-001-BLA-3538' },
    { id: 'var-2', isMatrixParent: false, kind: 0, sku: 'CALC-001-NEG-3941' },
  ]

  const foundUpper = matchItemByBarcodeOrSku('CALC-001-BLA-3538', catalog)
  assert.equal(foundUpper?.id, 'var-1')

  const foundLower = matchItemByBarcodeOrSku('calc-001-bla-3538', catalog)
  assert.equal(foundLower?.id, 'var-1')

  const notFound = matchItemByBarcodeOrSku('INEXISTENTE', catalog)
  assert.equal(notFound, null)
})

test('Escáner — Ignora ítems que son productos matriz (padres)', () => {
  const catalog = [
    { id: 'parent-1', isMatrixParent: true, kind: 0, sku: 'MODELO-PADRE' },
  ]
  const result = matchItemByBarcodeOrSku('MODELO-PADRE', catalog)
  assert.equal(result, null)
})

test('Escáner — Encuentra ítem por código de barras en customAttributesJson', () => {
  const catalog = [
    {
      id: 'var-1',
      isMatrixParent: false,
      kind: 0,
      sku: 'NIK-001',
      customAttributesJson: JSON.stringify({ barcode: '7861234567890' }),
    },
    {
      id: 'var-2',
      isMatrixParent: false,
      kind: 0,
      sku: 'NIK-002',
      customAttributesJson: JSON.stringify({ ean: '7869876543210' }),
    },
  ]

  const found1 = matchItemByBarcodeOrSku('7861234567890', catalog)
  assert.equal(found1?.id, 'var-1')

  const found2 = matchItemByBarcodeOrSku('7869876543210', catalog)
  assert.equal(found2?.id, 'var-2')
})

test('Visualización limpia de variante — Quita prefijo de modelo padre', () => {
  const parentName = 'Calcetín Deportivo Nike Elite'
  const variantFullName = 'Calcetín Deportivo Nike Elite - Blanco / 35-38'
  const clean = formatVariantDisplayName(variantFullName, parentName)
  assert.equal(clean, 'Blanco · 35-38')
})
