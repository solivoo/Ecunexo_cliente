import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
} from '@/components/ui'
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
  const [confirmDelete, setConfirmDelete] = useState<CategoryListItemDto | null>(null)
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

  const handleDelete = useCallback(async () => {
    if (!tenantId || !canManage || !confirmDelete) return

    setDeletingId(confirmDelete.id)
    try {
      await softDeleteCatalogCategory(tenantId, confirmDelete.id)
      toast.show({
        title: 'Categoría eliminada',
        message: `«${confirmDelete.name}» quedó dada de baja.`,
        variant: 'success',
      })
      setConfirmDelete(null)
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
  }, [canManage, confirmDelete, load, tenantId, toast])

  const isEmpty = !loading && rows.length === 0 && !error
  const withSchema = rows.filter((r) => parseAttributeSchema(r.attributeSchemaJson).length > 0).length
  const roots = rows.filter((r) => !r.parentId).length

  if (!canRead) {
    return (
      <TenantSessionGate title="Categorías" lead="Moldes de atributos para los ítems del catálogo.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres catalog.item.read para visualizar las categorías de la empresa."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Categorías"
      lead="Clasifican ítems y pueden definir un molde de atributos dinámicos."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Categorías del Catálogo"
          subtitle="Clasificación taxonómica de productos y servicios. Permiten estructurar jerarquías y definir atributos personalizados dinámicos para los ítems."
          badge={
            <StatusBadge tone="primary" withDot>
              {rows.length} {rows.length === 1 ? 'Categoría' : 'Categorías'}
            </StatusBadge>
          }
          actions={
            <>
              {canManage && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/catalogo/categorias/nueva')}
                >
                  + Nueva Categoría
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de categorías"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de categorías">
          <StatCard
            label="Total Categorías"
            value={rows.length}
            icon="category"
            toneColor="#4f46e5"
            footerText="Familias registradas"
          />
          <StatCard
            label="Con Atributos Extra"
            value={withSchema}
            icon="schema"
            toneColor="#0ea5e9"
            footerText="Moldes dinámicos definidos"
          />
          <StatCard
            label="Categorías Raíz"
            value={roots}
            icon="account_tree"
            toneColor="#10b981"
            footerText="Nivel superior en árbol"
          />
        </div>

        <SectionCard
          title="Estructura de Categorías"
          subtitle="Árbol de familias y configuración de moldes adicionales para ítems"
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {isEmpty ? (
            <EmptyState
              icon="folder_tree"
              title="Aún no hay categorías registradas"
              description="Las categorías te permiten organizar el catálogo y solicitar campos específicos como talla, color o material al registrar productos."
              action={
                canManage ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/catalogo/categorias/nueva')}
                  >
                    + Nueva Categoría
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <CategoriesGrid
              rows={rows}
              loading={loading}
              canEdit={canManage}
              canDelete={canManage}
              deletingId={deletingId}
              onDelete={setConfirmDelete}
            />
          )}
        </SectionCard>
      </div>

      <Popup
        open={confirmDelete !== null}
        title="Eliminar categoría"
        onClose={() => setConfirmDelete(null)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDelete(null),
            disabled: deletingId !== null,
          },
          {
            id: 'confirm',
            label: 'Sí, eliminar',
            variant: 'primary',
            onClick: () => {
              void handleDelete()
            },
            disabled: deletingId !== null,
          },
        ]}
      >
        {confirmDelete ? (
          <p className="app-shell__muted">
            ¿Dar de baja <strong>{confirmDelete.name}</strong>? Solo se permite si no tiene ítems ni
            subcategorías asociadas. Es una baja lógica.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}
