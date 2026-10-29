import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, Select, useToast } from 'glubox'
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
  GridToolbarRefresh,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'

import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { CatalogItemsGrid } from '@/pages/catalog/CatalogItemsGrid'
import {
  listCatalogItems,
  setCatalogItemStorefrontVisibility,
  softDeleteCatalogItem,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CatalogItemKind,
  CatalogItemStatus,
  type CatalogItemListItemDto,
} from '@/types/catalogApi'

export function CatalogItemsListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const hasItemRead = useHasPermission('catalog.item.read')
  const hasMatrixRead = useHasPermission('catalog.matrix.read')
  const canRead = hasItemRead || hasMatrixRead
  const canCreate = useHasPermission('catalog.item.create')
  const canEdit = useHasPermission('catalog.item.update')
  const canDelete = useHasPermission('catalog.item.delete')
  const canHide = useHasPermission('catalog.item.hide')
  const canAssignPrice = useHasPermission('catalog.pricing.create')

  const [rows, setRows] = useState<CatalogItemListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<CatalogItemListItemDto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [hidingId, setHidingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      if (!opts?.silent) setLoading(true)
      try {
        setRows(await listCatalogItems(tenantId, { includeParents: false }))
        setError(null)
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


  const handleDelete = useCallback(async () => {
    if (!tenantId || !canDelete || !confirmDelete) return

    setDeletingId(confirmDelete.id)
    try {
      await softDeleteCatalogItem(tenantId, confirmDelete.id)
      toast.show({
        title: 'Ítem eliminado',
        message: `«${confirmDelete.name}» quedó dado de baja.`,
        variant: 'success',
      })
      setConfirmDelete(null)
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
  }, [canDelete, confirmDelete, load, tenantId, toast])

  const handleToggleHidden = useCallback(
    async (row: CatalogItemListItemDto) => {
      if (!tenantId || !canHide) return

      const hidden = !row.isHiddenFromStorefront
      setHidingId(row.id)
      try {
        await setCatalogItemStorefrontVisibility(tenantId, row.id, hidden)
        toast.show({
          title: hidden ? 'Producto oculto' : 'Producto visible',
          message: hidden
            ? `«${row.name}» ya no se muestra en la tienda online.`
            : `«${row.name}» vuelve a mostrarse en la tienda online.`,
          variant: 'success',
        })
        await load({ silent: true })
      } catch (err: unknown) {
        toast.show({
          title: hidden ? 'No se pudo ocultar' : 'No se pudo mostrar',
          message: readApiError(err, 'Intenta nuevamente en unos segundos.'),
          variant: 'error',
        })
      } finally {
        setHidingId(null)
      }
    },
    [canHide, load, tenantId, toast]
  )

  const isEmpty = !loading && rows.length === 0 && !error
  const physicalCount = useMemo(
    () => rows.filter((r) => r.kind === CatalogItemKind.Physical).length,
    [rows]
  )
  const serviceCount = useMemo(
    () => rows.filter((r) => r.kind === CatalogItemKind.Service).length,
    [rows]
  )
  const activeCount = useMemo(
    () => rows.filter((r) => r.status === CatalogItemStatus.Active).length,
    [rows]
  )
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const inactiveCount = useMemo(
    () => rows.filter((r) => r.status === CatalogItemStatus.Inactive).length,
    [rows]
  )
  const hiddenCount = useMemo(
    () => rows.filter((r) => r.isHiddenFromStorefront).length,
    [rows]
  )
  const filteredRows = useMemo(() => {
    const byStatus =
      statusFilter === 'active'
        ? rows.filter((r) => r.status === CatalogItemStatus.Active)
        : statusFilter === 'inactive'
          ? rows.filter((r) => r.status === CatalogItemStatus.Inactive)
          : rows

    if (visibilityFilter === 'visible') {
      return byStatus.filter((r) => !r.isHiddenFromStorefront)
    }
    if (visibilityFilter === 'hidden') {
      return byStatus.filter((r) => r.isHiddenFromStorefront)
    }
    return byStatus
  }, [rows, statusFilter, visibilityFilter])

  if (!canRead) {
    return (
      <TenantSessionGate title="Catálogo" lead="Maestro de productos y servicios sin existencias físicas.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.item.read para visualizar el catálogo de la empresa."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Ítems"
      lead="Maestro de productos y servicios."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-catalog-page">
        <PageHeader
          title="Ítems del Catálogo"
          subtitle="Productos y servicios."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de catálogo">
          <StatCard
            className="ecu-stat-card--lead"
            label="Ítems"
            value={rows.length}
            toneColor="var(--shell-primary)"
          />
          <StatCard
            className="ecu-stat-card--kind-physical"
            label="Físicos"
            value={physicalCount}
          />
          <StatCard
            className="ecu-stat-card--kind-service"
            label="Servicios"
            value={serviceCount}
          />
          <StatCard
            className="ecu-stat-card--status-ok"
            label="Activos"
            value={activeCount}
            toneColor="var(--idt-ok)"
          />
          <StatCard
            className="ecu-stat-card--status-warn"
            label="Ocultos en tienda"
            value={hiddenCount}
            toneColor="var(--idt-warn)"
          />
        </div>


          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {isEmpty ? (
            <EmptyState
              icon="inventory_2"
              title="Aún no hay ítems registrados"
              description="Crea un servicio o un producto físico con su código SKU."
              action={
                canCreate ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/catalogo/items/nuevo')}
                  >
                    + Nueva Matriz
                  </Button>
                ) : undefined
              }
            />
          ) : (

          <SectionCard>
            <CatalogItemsGrid
              rows={filteredRows}
              loading={loading}
              canEdit={canEdit}
              canAssignPrice={canAssignPrice}
              canDelete={canDelete}
              canHide={canHide}
              deletingId={deletingId}
              hidingId={hidingId}
              onDelete={setConfirmDelete}
              onToggleHidden={handleToggleHidden}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  <Select
                    id="catalog-items-status-filter"
                    aria-label="Filtrar por estado"
                    variant="outline"
                    size="sm"
                    width="200"
                    options={[
                      { value: 'all', label: `Todos (${rows.length})` },
                      { value: 'active', label: `Activos (${activeCount})` },
                      { value: 'inactive', label: `Inactivos (${inactiveCount})` },
                    ]}
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val as 'all' | 'active' | 'inactive')}
                  />

                  <Select
                    id="catalog-items-visibility-filter"
                    aria-label="Filtrar por visibilidad en tienda"
                    variant="outline"
                    size="sm"
                    width="200"
                    options={[
                      { value: 'all', label: `Visibilidad (${rows.length})` },
                      { value: 'visible', label: `Visibles (${rows.length - hiddenCount})` },
                      { value: 'hidden', label: `Ocultos (${hiddenCount})` },
                    ]}
                    value={visibilityFilter}
                    onChange={(val) => setVisibilityFilter(val as 'all' | 'visible' | 'hidden')}
                  />

                  {canCreate && (
                    <Button
                      type="button"
                      width="160"
                      size="sm"
                      variant="primary"
                      onClick={() => navigate('/catalogo/items/nuevo')}
                    >
                      + Nueva Matriz
                    </Button>
                  )}

                </div>
              }
            />
          </SectionCard>
          )}

      </div>

      <Popup
        open={confirmDelete !== null}
        title="Eliminar ítem"
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
            onClick: () => { void handleDelete() },
            disabled: deletingId !== null,
          },
        ]}
      >
        {confirmDelete ? (
          <p className="app-shell__muted">
            ¿Dar de baja <strong>{confirmDelete.name}</strong>
            {confirmDelete.sku ? ` (${confirmDelete.sku})` : ''}? Solo se permite si no tiene stock,
            movimientos ni documentos. Es una baja lógica.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}
