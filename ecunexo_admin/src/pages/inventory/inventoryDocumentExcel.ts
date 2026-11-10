import ExcelJS from 'exceljs'

export type InventoryExcelLineDraft = {
  catalogItemId: string
  quantity: string
  unitCost: string
}

export type InventoryExcelParseResult = {
  lines: InventoryExcelLineDraft[]
  matchedCount: number
  unmatchedCodes: string[]
  invalidRows: string[]
}

const SHEET_NAME = 'Lineas'
const HEADER_SKU = 'SKU'
const HEADER_QTY = 'Cantidad'
const HEADER_COST = 'CostoUnitario'

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('result' in value && value.result != null) return cellText(value.result as ExcelJS.CellValue)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join('').trim()
    }
  }
  return String(value).trim()
}

function parseNumber(raw: string): number | null {
  if (!raw) return null
  const n = Number(raw.replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : null
}

export async function buildInventoryLinesTemplateBlob(): Promise<Blob> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'EcuNexo'
  wb.created = new Date()

  const sheet = wb.addWorksheet(SHEET_NAME)
  sheet.columns = [
    { header: HEADER_SKU, key: 'sku', width: 22 },
    { header: HEADER_QTY, key: 'qty', width: 12 },
    { header: HEADER_COST, key: 'cost', width: 16 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.addRow({ sku: 'SKU-EJEMPLO', qty: 1, cost: 0 })
  sheet.addRow({ sku: '7891234567890', qty: 2, cost: 12.5 })

  const help = wb.addWorksheet('Instrucciones')
  help.getColumn(1).width = 92
  help.addRow(['Plantilla de líneas para documentos de inventario (EcuNexo)'])
  help.addRow([])
  help.addRow([`1. Completa la hoja «${SHEET_NAME}». No renombres las columnas.`])
  help.addRow(['2. SKU: código SKU o código de barras del ítem físico activo.'])
  help.addRow(['3. Cantidad: número mayor que cero (en ajustes puede ser cero).'])
  help.addRow(['4. CostoUnitario: opcional; se usa en recepciones. Vacío = sin costo.'])
  help.addRow(['5. Filas con SKU desconocido se omiten; el resto se carga al documento.'])
  help.getRow(1).font = { bold: true }

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function parseInventoryLinesWorkbook(
  file: File,
  resolveItem: (code: string) => { id: string } | null,
  opts?: { allowZeroQuantity?: boolean; applyUnitCost?: boolean }
): Promise<InventoryExcelParseResult> {
  const allowZeroQuantity = opts?.allowZeroQuantity ?? false
  const applyUnitCost = opts?.applyUnitCost ?? true

  const wb = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await wb.xlsx.load(buffer)

  const sheet = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0]
  if (!sheet) {
    throw new Error('El archivo no contiene hojas de cálculo.')
  }

  const headerRow = sheet.getRow(1)
  const headers = [1, 2, 3].map((col) => cellText(headerRow.getCell(col).value).toLowerCase())
  const skuIdx = headers.findIndex((h) => h === HEADER_SKU.toLowerCase() || h === 'sku' || h === 'codigo' || h === 'código')
  const qtyIdx = headers.findIndex(
    (h) => h === HEADER_QTY.toLowerCase() || h === 'cantidad' || h === 'qty' || h === 'quantity'
  )
  const costIdx = headers.findIndex(
    (h) =>
      h === HEADER_COST.toLowerCase() ||
      h === 'costounitario' ||
      h === 'costo' ||
      h === 'costo unitario' ||
      h === 'unitcost'
  )

  if (skuIdx < 0 || qtyIdx < 0) {
    throw new Error(`Cabeceras inválidas. Se esperan columnas «${HEADER_SKU}» y «${HEADER_QTY}».`)
  }

  const aggregated = new Map<
    string,
    { catalogItemId: string; quantity: number; unitCost: string }
  >()
  const unmatchedCodes: string[] = []
  const invalidRows: string[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const sku = cellText(row.getCell(skuIdx + 1).value)
    if (!sku) return
    if (sku.toUpperCase() === 'SKU-EJEMPLO') return

    const qtyRaw = cellText(row.getCell(qtyIdx + 1).value)
    const qty = parseNumber(qtyRaw)
    if (qty == null || (allowZeroQuantity ? qty < 0 : qty <= 0)) {
      invalidRows.push(`Fila ${rowNumber}: cantidad inválida «${qtyRaw || 'vacía'}»`)
      return
    }

    const matched = resolveItem(sku)
    if (!matched) {
      unmatchedCodes.push(sku)
      return
    }

    let unitCost = ''
    if (applyUnitCost && costIdx >= 0) {
      const costRaw = cellText(row.getCell(costIdx + 1).value)
      if (costRaw) {
        const cost = parseNumber(costRaw)
        if (cost == null || cost < 0) {
          invalidRows.push(`Fila ${rowNumber}: costo inválido «${costRaw}»`)
          return
        }
        unitCost = String(cost)
      }
    }

    const prev = aggregated.get(matched.id)
    if (prev) {
      aggregated.set(matched.id, {
        catalogItemId: matched.id,
        quantity: prev.quantity + qty,
        unitCost: unitCost || prev.unitCost,
      })
    } else {
      aggregated.set(matched.id, {
        catalogItemId: matched.id,
        quantity: qty,
        unitCost,
      })
    }
  })

  const lines: InventoryExcelLineDraft[] = [...aggregated.values()].map((l) => ({
    catalogItemId: l.catalogItemId,
    quantity: String(l.quantity),
    unitCost: l.unitCost,
  }))

  return {
    lines,
    matchedCount: lines.length,
    unmatchedCodes: [...new Set(unmatchedCodes)],
    invalidRows,
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
