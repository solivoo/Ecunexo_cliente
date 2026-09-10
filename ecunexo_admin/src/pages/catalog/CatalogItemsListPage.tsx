import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, Select, useToast, type PageActionItem } from 'glubox'
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
import { readApiError } from '@/lib/readApiError'
import { CatalogItemsGrid } from '@/pages/catalog/CatalogItemsGrid'
import { listCatalogItems, softDeleteCatalogItem } from '@/services/catalogApi'
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
  const hasProductRead = useHasPermission('catalog.product.read')
  const canRead = hasItemRead || hasProductRead
  const canCreate = useHasPermission('catalog.item.create')
  const canEdit = useHasPermission('catalog.item.update')
  const canDelete = useHasPermission('catalog.item.delete')
  const [rows, setRows] = useState<CatalogItemListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<CatalogItemListItemDto | null>(null)
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
  const inactiveCount = useMemo(
    () => rows.filter((r) => r.status === CatalogItemStatus.Inactive).length,
    [rows]
  )
  const filteredRows = useMemo(() => {
    if (statusFilter === 'active') {
      return rows.filter((r) => r.status === CatalogItemStatus.Active)
    }
    if (statusFilter === 'inactive') {
      return rows.filter((r) => r.status === CatalogItemStatus.Inactive)
    }
    return rows
  }, [rows, statusFilter])

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
      lead="Maestro de productos y servicios. Las existencias físicas se gestionan en inventario."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Ítems del Catálogo"
          subtitle="Maestro unificado de productos físicos y servicios. Los productos físicos requieren SKU para trazabilidad en inventario; los servicios se facturan sin control de existencias."
          badge={
            <StatusBadge tone="primary" withDot>
              {rows.length} {rows.length === 1 ? 'Ítem' : 'Ítems'}
            </StatusBadge>
          }
          actions={
            <>
              {canCreate && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/catalogo/items/nuevo')}
                >
                  + Nuevo Ítem
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de catálogo"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de catálogo">
          <StatCard
            label="Total Ítems"
            value={rows.length}
            icon="inventory_2"
            toneColor="#4f46e5"
            footerText="Catálogo registrado"
          />
          <StatCard
            label="Productos Físicos"
            value={physicalCount}
            icon="qr_code_2"
            toneColor="#0ea5e9"
            footerText="Con SKU e inventario"
          />
          <StatCard
            label="Servicios"
            value={serviceCount}
            icon="design_services"
            toneColor="#10b981"
            footerText="Sin control de existencias"
          />
          <StatCard
            label="Ítems Activos"
            value={activeCount}
            icon="verified"
            toneColor="#8b5cf6"
            footerText="Habilitados comercialmente"
          />
        </div>

        <SectionCard
          title="Inventario de Productos y Servicios"
          subtitle="Listado maestro de prestaciones comerciales y trazabilidad de códigos"
        >
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
              description="Empieza creando un servicio (intangible) o un producto físico con su respectivo código SKU para control de almacén."
              action={
                canCreate ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/catalogo/items/nuevo')}
                  >
                    + Nuevo Ítem
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <CatalogItemsGrid
              rows={filteredRows}
              loading={loading}
              canEdit={canEdit}
              canDelete={canDelete}
              deletingId={deletingId}
              onDelete={setConfirmDelete}
              toolbarRight={
                <div style={{ minWidth: 170 }}>
                  <Select
                    id="catalog-items-status-filter"
                    aria-label="Filtrar por estado"
                    variant="outline"
                    options={[
                      { value: 'all', label: `Todos (${rows.length})` },
                      { value: 'active', label: `Activos (${activeCount})` },
                      { value: 'inactive', label: `Inactivos (${inactiveCount})` },
                    ]}
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val as 'all' | 'active' | 'inactive')}
                  />
                </div>
              }
            />
          )}
        </SectionCard>
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
            onClick: () => {
              void handleDelete()
            },
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
