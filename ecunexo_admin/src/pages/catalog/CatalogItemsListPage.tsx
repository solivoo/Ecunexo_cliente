import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { CatalogItemsGrid } from '@/pages/catalog/CatalogItemsGrid'
import { listCatalogItems, softDeleteCatalogItem } from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CatalogItemListItemDto } from '@/types/catalogApi'

export function CatalogItemsListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canRead =
    useHasPermission('catalog.item.read') || useHasPermission('catalog.product.read')
  const canCreate = useHasPermission('catalog.item.create')
  const canEdit = useHasPermission('catalog.item.update')
  const canDelete = useHasPermission('catalog.item.delete')
  const [rows, setRows] = useState<CatalogItemListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listCatalogItems(tenantId))
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Listado de ítems sincronizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar el catálogo.')
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
    if (canCreate) {
      items.push({
        id: 'create',
        label: 'Nuevo ítem',
        icon: 'plus',
        route: '/catalogo/items/nuevo',
        disabled: false,
      })
    }
    items.push(
      {
        id: 'categories',
        label: 'Categorías',
        icon: 'folder-tree',
        route: '/catalogo/categorias',
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
  }, [canCreate, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
      }
    },
    [load]
  )

  const handleDelete = useCallback(
    async (row: CatalogItemListItemDto) => {
      if (!tenantId || !canDelete) return
      const ok = window.confirm(
        `¿Eliminar «${row.name}»? Solo se permite si no tiene stock, movimientos ni documentos.`
      )
      if (!ok) return

      setDeletingId(row.id)
      try {
        await softDeleteCatalogItem(tenantId, row.id)
        toast.show({
          title: 'Ítem eliminado',
          message: `«${row.name}» quedó dado de baja.`,
          variant: 'success',
        })
        await load({ silent: true })
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo eliminar',
          message: readApiError(
            err,
            'El ítem tiene registros asociados. Desactívalo o modifícalo.'
          ),
          variant: 'error',
        })
      } finally {
        setDeletingId(null)
      }
    },
    [canDelete, load, tenantId, toast]
  )

  const isEmpty = !loading && rows.length === 0 && !error

  if (!canRead) {
    return (
      <TenantSessionGate title="Catálogo" lead="Maestro de qué se vende o se usa, sin cantidades.">
        <p className="app-shell__page-lead">Requieres catalog.item.read para ver el catálogo.</p>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Ítems" lead="Maestro de productos y servicios. El stock vive en inventario.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Los servicios no llevan SKU. Los físicos sí: un ítem, un código (ADR-010).
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de catálogo"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={handleActionSelect}
          />
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de catálogo">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Ítems</p>
            <p className="ecu-companies-page__metric-value">{rows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Servicios</p>
            <p className="ecu-companies-page__metric-value">
              {rows.filter((r) => r.kind === 1).length}
            </p>
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
              <h2 className="app-shell__section-title">Aún no hay ítems</h2>
              <p className="app-shell__muted app-shell__muted--pad-bottom">
                Empieza por un servicio (consultoría, instalación) o un producto físico con SKU.
              </p>
              {canCreate ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/catalogo/items/nuevo')}
                >
                  Nuevo ítem
                </Button>
              ) : (
                <p className="app-shell__muted">
                  Requieres catalog.item.create para dar de alta ítems.
                </p>
              )}
            </div>
          ) : (
            <CatalogItemsGrid
              rows={rows}
              loading={loading}
              canEdit={canEdit}
              canDelete={canDelete}
              deletingId={deletingId}
              onDelete={(row) => void handleDelete(row)}
            />
          )}
        </div>
      </div>
    </TenantSessionGate>
  )
}
