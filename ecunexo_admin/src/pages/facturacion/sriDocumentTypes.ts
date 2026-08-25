/** Tipos de comprobante SRI. Ventas y compras no se mezclan en la misma pantalla. */

export type SriDocumentType = {
  readonly code: string
  readonly sriCode: string | null
  readonly label: string
  readonly shortLabel: string
  readonly hint: string
  readonly available: boolean
  readonly emitPath: string | null
}

export const SALE_DOCUMENT_TYPES: readonly SriDocumentType[] = [
  {
    code: 'all',
    sriCode: null,
    label: 'Todos',
    shortLabel: 'Todos',
    hint: 'Comprobantes de venta que emite la empresa.',
    available: true,
    emitPath: null,
  },
  {
    code: '01',
    sriCode: '01',
    label: 'Factura',
    shortLabel: 'Factura',
    hint: 'Comprobante de venta (SRI 01).',
    available: true,
    emitPath: '/facturacion/facturas/emitir',
  },
  {
    code: '04',
    sriCode: '04',
    label: 'Nota de crédito',
    shortLabel: 'NC',
    hint: 'Anula o descuenta una factura autorizada (SRI 04).',
    available: true,
    emitPath: null,
  },
  {
    code: '05',
    sriCode: '05',
    label: 'Nota de débito',
    shortLabel: 'ND',
    hint: 'Intereses o recargos sobre una factura (SRI 05).',
    available: false,
    emitPath: null,
  },
  {
    code: '06',
    sriCode: '06',
    label: 'Guía de remisión',
    shortLabel: 'Guía',
    hint: 'Traslado de mercadería vendida (SRI 06). El ingreso a bodega irá en Inventario.',
    available: false,
    emitPath: null,
  },
]

export const PURCHASE_DOCUMENT_TYPES: readonly SriDocumentType[] = [
  {
    code: 'all',
    sriCode: null,
    label: 'Todos',
    shortLabel: 'Todos',
    hint: 'Lo que compras: facturas de proveedor, retenciones y liquidaciones.',
    available: true,
    emitPath: null,
  },
  {
    code: 'prov',
    sriCode: null,
    label: 'Factura de proveedor',
    shortLabel: 'Proveedor',
    hint: 'Factura que te emite el proveedor (la registras, no la emites).',
    available: false,
    emitPath: null,
  },
  {
    code: '07',
    sriCode: '07',
    label: 'Retención',
    shortLabel: 'Retención',
    hint: 'Comprobante de retención en la fuente (SRI 07). Lo emites tú al pagar.',
    available: false,
    emitPath: null,
  },
  {
    code: '03',
    sriCode: '03',
    label: 'Liquidación de compra',
    shortLabel: 'Liquidación',
    hint: 'Compra a quien no tiene RUC (SRI 03). Lo emites tú como comprador.',
    available: false,
    emitPath: null,
  },
]

export function sriDocumentTypeByCode(
  code: string | null | undefined,
  catalog: readonly SriDocumentType[]
): SriDocumentType {
  const found = catalog.find((t) => t.code === code)
  return found ?? catalog.find((t) => t.code === 'all') ?? catalog[0]!
}

export function sriTypeFilterOptions(
  catalog: readonly SriDocumentType[]
): { value: string; label: string }[] {
  return catalog.map((t) => ({ value: t.code, label: t.shortLabel }))
}
