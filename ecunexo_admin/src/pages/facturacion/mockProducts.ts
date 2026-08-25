/** Catálogo temporal de productos (sin bodegas/inventario). */
export type MockProduct = {
  readonly id: string
  readonly code: string
  readonly sku: string
  readonly name: string
  readonly unitPrice: number
  /** Porcentaje IVA (0 | 5 | 15). */
  readonly ivaRate: number
}

export const MOCK_PRODUCTS: readonly MockProduct[] = [
  {
    id: 'p1',
    code: 'SRV-001',
    sku: 'SKU-SRV-001',
    name: 'Consultoría técnica (hora)',
    unitPrice: 45,
    ivaRate: 15,
  },
  {
    id: 'p2',
    code: 'SRV-002',
    sku: 'SKU-SRV-002',
    name: 'Soporte mensual plan Básico',
    unitPrice: 120,
    ivaRate: 15,
  },
  {
    id: 'p3',
    code: 'PROD-010',
    sku: 'SKU-LIC-010',
    name: 'Licencia software anual',
    unitPrice: 350,
    ivaRate: 15,
  },
  {
    id: 'p4',
    code: 'PROD-020',
    sku: 'SKU-OFC-020',
    name: 'Material de oficina (paquete)',
    unitPrice: 18.5,
    ivaRate: 15,
  },
  {
    id: 'p5',
    code: 'EXN-001',
    sku: 'SKU-EXN-001',
    name: 'Servicio exento de IVA',
    unitPrice: 80,
    ivaRate: 0,
  },
  {
    id: 'p6',
    code: 'PROD-030',
    sku: 'SKU-PROD-030',
    name: 'Producto tarifa 5%',
    unitPrice: 25,
    ivaRate: 5,
  },
] as const

export const MOCK_PRODUCT_OPTIONS = MOCK_PRODUCTS.map((p) => ({
  value: p.id,
  label: `${p.sku} — ${p.name}`,
}))
