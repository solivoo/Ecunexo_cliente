import { useCallback, useEffect, useState } from 'react'
import { compressCompanyLogo } from '@/features/organization/compressCompanyLogo'
import { readApiError } from '@/lib/readApiError'
import {
  deleteBrandLogo,
  listBrandLogos,
  selectBrandLogos,
  uploadBrandLogo,
  type BrandLogoCatalog,
  type BrandLogoListItem,
} from '@/services/brandLogoApi'

export function useCompanyLogos(tenantId: string) {
  const [catalog, setCatalog] = useState<BrandLogoCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      setCatalog(await listBrandLogos(tenantId))
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudieron cargar los logos.'))
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void reload()
  }, [reload])

  const upload = useCallback(
    async (files: File[]) => {
      setBusy(true)
      try {
        for (const file of files) {
          const compressed = await compressCompanyLogo(file)
          await uploadBrandLogo(tenantId, compressed)
        }
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [reload, tenantId]
  )

  const select = useCallback(
    async (patch: Partial<Pick<BrandLogoCatalog, 'lightLogoId' | 'darkLogoId' | 'preferWordmark'>>) => {
      if (!catalog) return
      const next = {
        lightLogoId: patch.lightLogoId ?? catalog.lightLogoId,
        darkLogoId: patch.darkLogoId ?? catalog.darkLogoId,
        preferWordmark: patch.preferWordmark ?? catalog.preferWordmark,
      }
      setBusy(true)
      try {
        await selectBrandLogos(tenantId, next)
        setCatalog({ ...catalog, ...next })
      } finally {
        setBusy(false)
      }
    },
    [catalog, tenantId]
  )

  const remove = useCallback(
    async (logoId: string) => {
      setBusy(true)
      try {
        await deleteBrandLogo(tenantId, logoId)
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [reload, tenantId]
  )

  const itemById = useCallback(
    (id: string | null): BrandLogoListItem | null =>
      catalog?.items.find((row) => row.id === id) ?? null,
    [catalog]
  )

  return { catalog, loading, busy, error, upload, select, remove, itemById, reload }
}
