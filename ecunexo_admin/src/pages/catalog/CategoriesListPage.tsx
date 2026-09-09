import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { parseAttributeSchema } from '@/lib/catalogAttributes'
import { readApiError } from '@/lib/readApiError'
import { CategoriesGrid } from '@/pages/catalog/CategoriesGrid'
import { listCatalogCategories, softDeleteCatalogCategory } from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CategoryListItemDto } from '@/types/catalogApi'

export function CategoriesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canRead =
    useHasPermission('catalog.item.read') ||
    useHasPermission('catalog.category.manage') ||
    useHasPermission('catalog.product.read')
  const canManage = useHasPermission('catalog.category.manage')
  const [rows, setRows] = useState<CategoryListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listCatalogCategories(tenantId))
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Listado de categorías sincronizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar las categorías.')
        setError(message)
        setRows([])
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    if (!canRead) return
    void load({ silent: true })
  }, [canRead, load])

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canManage) {
      items.push({
        id: 'create',
        label: 'Nueva categoría',
        icon: 'plus',
        route: '/catalogo/categorias/nueva',
        disabled: false,
      })
    }
    items.push(
      {
        id: 'items',
        label: 'Ítems',
        icon: 'package',
        route: '/catalogo/items',
        disabled: false,
      },
      {
        id: 'refresh',
        label: 'Actualizar',
        icon: 'refresh-cw',
        route: null,
        disabled: loading,
      }
    )
    return items
  }, [canManage, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') void load()
    },
    [load]
  )

  const handleDelete = useCallback(
    async (row: CategoryListItemDto) => {
      if (!tenantId || !canManage) return
      const ok = window.confirm(
        `¿Eliminar «${row.name}»? Solo se permite si no tiene ítems ni subcategorías.`
      )
      if (!ok) return

      setDeletingId(row.id)
      try {
        await softDeleteCatalogCategory(tenantId, row.id)
        toast.show({
          title: 'Categoría eliminada',
          message: `«${row.name}» quedó dada de baja.`,
          variant: 'success',
        })
        await load({ silent: true })
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo eliminar',
          message: readApiError(
            err,
            'La categoría tiene ítems o subcategorías. Reasigna o edítala.'
          ),
          variant: 'error',
        })
      } finally {
        setDeletingId(null)
      }
    },
    [canManage, load, tenantId, toast]
  )

  const isEmpty = !loading && rows.length === 0 && !error
  const withSchema = rows.filter((r) => parseAttributeSchema(r.attributeSchemaJson).length > 0).length
  const roots = rows.filter((r) => !r.parentId).length

  if (!canRead) {
    return (
      <TenantSessionGate title="Categorías" lead="Moldes de atributos para los ítems del catálogo.">
        <p className="app-shell__page-lead">Requieres catalog.item.read para ver categorías.</p>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Categorías"
      lead="Clasifican ítems y pueden definir un molde de atributos (jsonb)."
    >
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            El molde se aplica al alta del ítem: talla, duración, material, etc.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de categorías"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={handleActionSelect}
          />
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de categorías">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Categorías</p>
            <p className="ecu-companies-page__metric-value">{rows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Con molde</p>
            <p className="ecu-companies-page__metric-value">{withSchema}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Raíz</p>
            <p className="ecu-companies-page__metric-value">{roots}</p>
          </article>
        </div>

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ecu-companies-page__body">
          {isEmpty ? (
            <div className="ecu-companies-page__empty">
              <h2 className="app-shell__section-title">Aún no hay categorías</h2>
              <p className="app-shell__muted app-shell__muted--pad-bottom">
                Son opcionales. Úsalas cuando un rubro necesite campos extra.
              </p>
              {canManage ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/catalogo/categorias/nueva')}
                >
                  Nueva categoría
                </Button>
              ) : (
                <p className="app-shell__muted">
                  Requieres catalog.category.manage para crear categorías.
                </p>
              )}
            </div>
          ) : (
            <CategoriesGrid
              rows={rows}
              loading={loading}
              canEdit={canManage}
              canDelete={canManage}
              deletingId={deletingId}
              onDelete={(row) => void handleDelete(row)}
            />
          )}
        </div>
      </div>
    </TenantSessionGate>
  )
}
