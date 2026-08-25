/** Qué puede hacer cada plan en el SPA. Alineado a doc/analisis-planes-empresas-ecuador.md */

export type PlanCode =
  | 'pro-independiente'
  | 'local-comercio'
  | 'taller-mixto'
  | 'empresa-pyme'
  | 'cadena-retail'
  | 'grupo-multi-ruc'

export type PlanCapability = {
  readonly code: PlanCode
  readonly label: string
  readonly modules: readonly string[]
  readonly catalog: boolean
  readonly warehouses: boolean
  readonly inventory: boolean
  readonly invoicing: boolean
}

const FULL_OPS = [
  'identity',
  'catalog',
  'inventory',
  'warehousing',
  'invoicing',
] as const

export const PLAN_MATRIX: readonly PlanCapability[] = [
  {
    code: 'pro-independiente',
    label: 'Independiente',
    modules: ['identity', 'catalog', 'invoicing'],
    catalog: true,
    warehouses: false,
    inventory: false,
    invoicing: true,
  },
  {
    code: 'local-comercio',
    label: 'Local',
    modules: FULL_OPS,
    catalog: true,
    warehouses: true,
    inventory: true,
    invoicing: true,
  },
  {
    code: 'taller-mixto',
    label: 'Taller',
    modules: FULL_OPS,
    catalog: true,
    warehouses: true,
    inventory: true,
    invoicing: true,
  },
  {
    code: 'empresa-pyme',
    label: 'Empresa',
    modules: FULL_OPS,
    catalog: true,
    warehouses: true,
    inventory: true,
    invoicing: true,
  },
  {
    code: 'cadena-retail',
    label: 'Cadena',
    modules: FULL_OPS,
    catalog: true,
    warehouses: true,
    inventory: true,
    invoicing: true,
  },
  {
    code: 'grupo-multi-ruc',
    label: 'Grupo',
    modules: FULL_OPS,
    catalog: true,
    warehouses: true,
    inventory: true,
    invoicing: true,
  },
]

export type PlanRouteReady =
  | { readonly kind: 'heading'; readonly name: RegExp }
  | { readonly kind: 'label'; readonly name: string }

export type PlanRouteCheck = {
  readonly path: string
  readonly ready: PlanRouteReady
  readonly allowed: boolean
}

export function routesForPlan(plan: PlanCapability): PlanRouteCheck[] {
  return [
    { path: '/catalogo/items', ready: { kind: 'label', name: 'Resumen de catálogo' }, allowed: plan.catalog },
    { path: '/bodegas', ready: { kind: 'label', name: 'Resumen de bodegas' }, allowed: plan.warehouses },
    { path: '/inventario/stock', ready: { kind: 'label', name: 'Resumen de stock' }, allowed: plan.inventory },
    {
      path: '/inventario/documentos',
      ready: { kind: 'label', name: 'Resumen de documentos' },
      allowed: plan.inventory,
    },
    {
      path: '/facturacion/comprobantes',
      ready: { kind: 'heading', name: /Comprobantes|Facturas/i },
      allowed: plan.invoicing,
    },
  ]
}

export function planByCode(code: string): PlanCapability | undefined {
  return PLAN_MATRIX.find((p) => p.code === code)
}
