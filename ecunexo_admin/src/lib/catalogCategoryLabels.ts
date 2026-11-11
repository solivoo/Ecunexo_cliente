import type { CategoryListItemDto } from '@/types/catalogApi'

/** Ruta completa raíz › … › categoría para selects. */
export function categorySelectLabel(
  category: CategoryListItemDto,
  byId: Map<string, CategoryListItemDto>
): string {
  const names: string[] = []
  const visited = new Set<string>()
  let current: CategoryListItemDto | undefined = category
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return names.join(' › ')
}

export function buildCategorySelectOptions(
  categories: CategoryListItemDto[],
  opts?: { emptyLabel?: string; excludeId?: string }
): { value: string; label: string }[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const emptyLabel = opts?.emptyLabel ?? 'Sin categoría'
  const excluded = new Set<string>()
  if (opts?.excludeId) {
    excluded.add(opts.excludeId)
    let added = true
    while (added) {
      added = false
      for (const c of categories) {
        if (c.parentId && excluded.has(c.parentId) && !excluded.has(c.id)) {
          excluded.add(c.id)
          added = true
        }
      }
    }
  }
  const rows = categories
    .filter((c) => !excluded.has(c.id))
    .map((c) => ({ value: c.id, label: categorySelectLabel(c, byId) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }))

  return [{ value: '', label: emptyLabel }, ...rows]
}
