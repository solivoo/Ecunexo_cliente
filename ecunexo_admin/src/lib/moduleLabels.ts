const MODULE_LABELS: Record<string, string> = {
  identity: 'Identidad',
  tenancy: 'Organización',
  platform: 'Plataforma',
  catalog: 'Catálogo',
  warehousing: 'Bodegas',
  inventory: 'Inventario',
  invoicing: 'Facturación',
  facturacion: 'Facturación',
  compras: 'Compras',
  accounting: 'Contabilidad',
  contabilidad: 'Contabilidad',
  customers: 'Clientes',
  clientes: 'Clientes',
  training: 'Capacitación',
  support: 'Soporte',
  repairs: 'Reparaciones',
  repair: 'Reparaciones',
  taller: 'Reparaciones',
}

export function moduleKey(code: string | null | undefined): string {
  const key = code?.trim().toLowerCase() ?? ''
  if (key === 'invoicing') return 'facturacion'
  if (key === 'accounting') return 'contabilidad'
  if (key === 'clientes') return 'customers'
  if (key === 'repair' || key === 'taller') return 'repairs'
  return key
}

export function moduleLabel(code: string): string {
  const key = moduleKey(code)
  if (!key) return code
  return MODULE_LABELS[key] ?? code.trim()
}

export function uniqueModuleSelectOptions(
  modules: ReadonlyArray<string | null | undefined>
): { value: string; label: string }[] {
  const byKey = new Map<string, string>()
  for (const raw of modules) {
    const key = moduleKey(raw)
    if (!key || byKey.has(key)) continue
    byKey.set(key, moduleLabel(raw ?? ''))
  }
  return [...byKey.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
    .map(([value, label]) => ({ value, label }))
}
