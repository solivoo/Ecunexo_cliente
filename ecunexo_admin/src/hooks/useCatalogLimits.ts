import { useAppSelector } from '@/store/hooks'
import { selectResolvedLimits } from '@/store/authSlice'

export type CatalogLimits = {
  maxVariants: number | null
  maxActiveVariants: number | null
  maxProductTemplates: number | null
}

/** Límites del módulo catálogo resueltos por sesión (claves `catalog.*` del backend). */
export function useCatalogLimits(): CatalogLimits {
  const limits = useAppSelector(selectResolvedLimits)

  return {
    maxVariants: limits?.['catalog.max_variants'] ?? null,
    maxActiveVariants: limits?.['catalog.max_active_variants'] ?? null,
    maxProductTemplates: limits?.['catalog.max_product_templates'] ?? null,
  }
}
