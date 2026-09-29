import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button, CheckButton, DataGrid, NumberBox, Popup, TextBox, useToast, type ColumnDef } from 'glubox'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  EmptyState,
  GridIconButton,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createShippingZone,
  deleteShippingZone,
  listShippingZones,
  updateShippingZone,
} from '@/services/shippingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CreateShippingZoneBody, ShippingZoneDto, UpdateShippingZoneBody } from '@/types/shippingApi'

type ZoneRow = ShippingZoneDto & { actions?: unknown } & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('zona de envío', 'zonas de envío')

export function ShippingZonesPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const hasOrderRead = useHasPermission('ecommerce.orders.read')
  const hasPricingRead = useHasPermission('catalog.pricing.read')
  const canRead = hasOrderRead || hasPricingRead

  const hasOrderManage = useHasPermission('ecommerce.orders.manage')
  const hasPricingCreate = useHasPermission('catalog.pricing.create')
  const canManage = hasOrderManage || hasPricingCreate

  const [rows, setRows] = useState<ShippingZoneDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<ShippingZoneDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ShippingZoneDto | null>(null)

  // Form states
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formProvinces, setFormProvinces] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listShippingZones(tenantId)
      setRows(data)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudieron cargar las zonas de envío.'))
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const openCreateModal = () => {
    setEditingZone(null)
    setFormCode('')
    setFormName('')
    setFormDescription('')
    setFormProvinces('')
    setFormSortOrder(rows.length + 1)
    setFormIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (z: ShippingZoneDto) => {
    setEditingZone(z)
    setFormCode(z.code)
    setFormName(z.name)
    setFormDescription(z.description ?? '')
    setFormProvinces(z.provinces ?? '')
    setFormSortOrder(z.sortOrder)
    setFormIsActive(z.isActive)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!tenantId) return
    const code = formCode.trim().toUpperCase()
    const name = formName.trim()

    if (!code) {
      toast.show({ title: 'Validación', message: 'El código de la zona es obligatorio.', variant: 'warning' })
      return
    }
    if (!name) {
      toast.show({ title: 'Validación', message: 'El nombre de la zona es obligatorio.', variant: 'warning' })
      return
    }

    setSaving(true)
    try {
      if (editingZone) {
        const body: UpdateShippingZoneBody = {
          code,
          name,
          description: formDescription.trim() || null,
          provinces: formProvinces.trim() || null,
          sortOrder: formSortOrder,
          isActive: formIsActive,
        }
        await updateShippingZone(tenantId, editingZone.id, body)
        toast.show({ title: 'Zona actualizada', message: 'Zona de envío modificada exitosamente.', variant: 'success' })
      } else {
        const body: CreateShippingZoneBody = {
          code,
          name,
          description: formDescription.trim() || null,
          provinces: formProvinces.trim() || null,
          sortOrder: formSortOrder,
        }
        await createShippingZone(tenantId, body)
        toast.show({ title: 'Zona creada', message: 'Nueva zona de envío registrada exitosamente.', variant: 'success' })
      }
      setModalOpen(false)
      void loadData()
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo guardar la zona de envío.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenantId || !confirmDelete) return
    try {
      await deleteShippingZone(tenantId, confirmDelete.id)
      toast.show({ title: 'Zona eliminada', message: 'La zona de envío ha sido eliminada.', variant: 'success' })
      setConfirmDelete(null)
      void loadData()
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No se pudo eliminar la zona. Podría tener tarifas asociadas.'),
        variant: 'error',
      })
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.provinces && r.provinces.toLowerCase().includes(q))
    )
  }, [rows, search])

  const totalCount = rows.length
  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])

  const columns: ColumnDef<ZoneRow>[] = useMemo(
    () => [
      {
        key: 'code',
        header: 'Código',
        width: 140,
        renderCell: (_val, row: ZoneRow) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={15} style={{ color: 'var(--glb-primary, #0284c7)' }} aria-hidden />
            <span style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{row.code}</span>
          </div>
        ),
      },
      {
        key: 'name',
        header: 'Nombre de la Zona',
        width: 220,
        renderCell: (_val, row: ZoneRow) => (
          <div>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
            {row.description ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
                {row.description}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'provinces',
        header: 'Provincias / Cobertura',
        renderCell: (_val, row: ZoneRow) => (
          <span style={{ fontSize: '0.8rem', color: row.provinces ? 'inherit' : 'var(--glb-muted, #94a3b8)' }}>
            {row.provinces || 'Toda la zona / Sin desglose'}
          </span>
        ),
      },
      {
        key: 'sortOrder',
        header: 'Orden',
        width: 80,
        align: 'center',
        renderCell: (_val, row: ZoneRow) => <span>{row.sortOrder}</span>,
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 90,
        align: 'center',
        renderCell: (_val, row: ZoneRow) => (
          <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
            {row.isActive ? 'Activa' : 'Inactiva'}
          </StatusBadge>
        ),
      },
      {
        key: 'actions',
        header: 'Acciones',
        sticky: 'right',
        width: 100,
        align: 'center',
        renderCell: (_val: unknown, row: ZoneRow) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            {canManage && (
              <GridIconButton
                label="Editar zona"
                icon={Pencil}
                onClick={() => openEditModal(row)}
              />
            )}
            {canManage && (
              <GridIconButton
                label="Eliminar zona"
                icon={Trash2}
                danger
                onClick={() => setConfirmDelete(row)}
              />
            )}
          </div>
        ),
      },
    ],
    [canManage]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Zonas de Envío" lead="Zonas geográficas de destino para envíos y fletes.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de ecommerce o catálogo para ver las zonas de envío."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Zonas de Envío" lead="Zonas geográficas de destino para envíos y fletes.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Zonas de Envío"
          subtitle="Crea y gestiona las zonas geográficas a donde despacha tu tienda (ej: Local, Provincias Sierra y Costa, Galápagos, Oriente)."
          actions={
            canManage ? (
              <Button variant="primary" iconLeft={<Plus size={16} />} onClick={openCreateModal}>
                + Nueva Zona
              </Button>
            ) : undefined
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de zonas">
          <StatCard label="Total de zonas" value={totalCount} />
          <StatCard label="Zonas activas" value={activeCount} />
        </div>

        <SectionCard
          title="Zonas de destino configuradas"
          subtitle="Define las regiones que utilizará la matriz de tarifas y la cotización en checkout."
        >
          {error ? (
            <p className="welcome-onboarding__error" role="alert">
              {error}
            </p>
          ) : null}

          <DataGrid<ZoneRow>
            className="ecu-companies-grid"
            dataSource={filteredRows as ZoneRow[]}
            keyExpr="id"
            columns={columns}
            selectionMode="none"
            showSearch={false}
            toolbarLeft={
              <div style={{ minWidth: 260, maxWidth: 360, width: '100%' }}>
                <TextBox
                  id="sz-search"
                  label="Buscar zona"
                  labelPosition="outlined"
                  variant="outline"
                  value={search}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  placeholder="Buscar por código, nombre o provincia…"
                  fullWidth
                />
              </div>
            }
            toolbarRight={
              <div className="ecu-grid-toolbar-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                {canManage ? (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={openCreateModal}>
                    + Nueva Zona
                  </Button>
                ) : null}
              </div>
            }
            paging={paging}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            paginationMode="client"
            pageSizeOptions={pageSizeOptions}
            layout="auto"
            loading={loading}
            emptyState={
              <EmptyState
                title="No hay zonas de envío configuradas"
                description="Crea tu primera zona de destino para empezar a definir tarifas de flete personalizadas."
                action={
                  canManage ? (
                    <Button variant="primary" onClick={openCreateModal}>
                      + Crear Zona de Envío
                    </Button>
                  ) : undefined
                }
              />
            }
            messages={gridMessages}
          />
        </SectionCard>

        {/* Modal Crear / Editar */}
        <Popup
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingZone ? 'Editar Zona de Envío' : 'Nueva Zona de Envío'}
          width="min(92vw, 34rem)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.75rem 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <div>
                <TextBox
                  id="sz-code"
                  label="Código *"
                  labelPosition="outlined"
                  variant="outline"
                  value={formCode}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="LOCAL, PROVINCIA"
                  fullWidth
                  disabled={Boolean(editingZone)}
                />
              </div>
              <div>
                <TextBox
                  id="sz-name"
                  label="Nombre de la Zona *"
                  labelPosition="outlined"
                  variant="outline"
                  value={formName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                  placeholder="Local / Urbano, Costa y Sierra…"
                  fullWidth
                />
              </div>
            </div>

            <div>
              <TextBox
                id="sz-desc"
                label="Descripción / Indicaciones"
                labelPosition="outlined"
                variant="outline"
                value={formDescription}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormDescription(e.target.value)}
                placeholder="Breve detalle de cobertura para facturación o despacho"
                fullWidth
              />
            </div>

            <div>
              <TextBox
                id="sz-provinces"
                label="Provincias comprendidas (separadas por comas)"
                labelPosition="outlined"
                variant="outline"
                value={formProvinces}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormProvinces(e.target.value)}
                placeholder="Pichincha, Guayas, Azuay…"
                fullWidth
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <NumberBox
                  id="sz-order"
                  label="Orden de visualización"
                  labelPosition="outlined"
                  variant="outline"
                  value={formSortOrder}
                  step={1}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormSortOrder(Number(e.target.value) || 0)}
                  fullWidth
                />
              </div>

              {editingZone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <CheckButton
                    id="sz-active"
                    variant="ghost"
                    checked={formIsActive}
                    onChange={(checked: boolean) => setFormIsActive(checked)}
                  >
                    {formIsActive ? 'Zona activa' : 'Zona inactiva'}
                  </CheckButton>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando...' : editingZone ? 'Actualizar Zona' : 'Crear Zona'}
              </Button>
            </div>
          </div>
        </Popup>

        {/* Modal Confirmar Eliminación */}
        <Popup
          open={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          title="Eliminar Zona de Envío"
          width="min(92vw, 28rem)"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              ¿Estás seguro de que deseas eliminar la zona <strong>{confirmDelete?.name}</strong> ({confirmDelete?.code})?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.5rem' }}>
              Esta acción no se puede deshacer. Las reglas de flete que utilicen esta zona deberán reasignarse.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="danger" onClick={() => void handleDelete()}>
                Eliminar
              </Button>
            </div>
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
