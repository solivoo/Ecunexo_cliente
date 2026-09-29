import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button, CheckButton, DataGrid, NumberBox, Popup, TextBox, useToast, type ColumnDef } from 'glubox'
import { Pencil, Plus, Trash2, Truck } from 'lucide-react'
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
  createShippingMethod,
  deleteShippingMethod,
  listShippingMethods,
  updateShippingMethod,
} from '@/services/shippingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CreateShippingMethodBody, ShippingMethodDto, UpdateShippingMethodBody } from '@/types/shippingApi'

type MethodRow = ShippingMethodDto & { actions?: unknown } & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('método de envío', 'métodos de envío')

export function ShippingMethodsPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const hasOrderRead = useHasPermission('ecommerce.orders.read')
  const hasPricingRead = useHasPermission('catalog.pricing.read')
  const canRead = hasOrderRead || hasPricingRead

  const hasOrderManage = useHasPermission('ecommerce.orders.manage')
  const hasPricingCreate = useHasPermission('catalog.pricing.create')
  const canManage = hasOrderManage || hasPricingCreate

  const [rows, setRows] = useState<ShippingMethodDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<ShippingMethodDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ShippingMethodDto | null>(null)

  // Form states
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formEstimatedDays, setFormEstimatedDays] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listShippingMethods(tenantId)
      setRows(data)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudieron cargar los métodos de envío.'))
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const openCreateModal = () => {
    setEditingMethod(null)
    setFormCode('')
    setFormName('')
    setFormDescription('')
    setFormEstimatedDays('24 a 48 horas')
    setFormSortOrder(rows.length + 1)
    setFormIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (m: ShippingMethodDto) => {
    setEditingMethod(m)
    setFormCode(m.code)
    setFormName(m.name)
    setFormDescription(m.description ?? '')
    setFormEstimatedDays(m.estimatedDays ?? '')
    setFormSortOrder(m.sortOrder)
    setFormIsActive(m.isActive)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!tenantId) return
    const code = formCode.trim().toUpperCase()
    const name = formName.trim()

    if (!code) {
      toast.show({ title: 'Validación', message: 'El código del transportista o método es obligatorio.', variant: 'warning' })
      return
    }
    if (!name) {
      toast.show({ title: 'Validación', message: 'El nombre del método de envío es obligatorio.', variant: 'warning' })
      return
    }

    setSaving(true)
    try {
      if (editingMethod) {
        const body: UpdateShippingMethodBody = {
          code,
          name,
          description: formDescription.trim() || null,
          estimatedDays: formEstimatedDays.trim() || null,
          sortOrder: formSortOrder,
          isActive: formIsActive,
        }
        await updateShippingMethod(tenantId, editingMethod.id, body)
        toast.show({ title: 'Método actualizado', message: 'Método de envío modificado exitosamente.', variant: 'success' })
      } else {
        const body: CreateShippingMethodBody = {
          code,
          name,
          description: formDescription.trim() || null,
          estimatedDays: formEstimatedDays.trim() || null,
          sortOrder: formSortOrder,
        }
        await createShippingMethod(tenantId, body)
        toast.show({ title: 'Método creado', message: 'Nuevo método de envío registrado exitosamente.', variant: 'success' })
      }
      setModalOpen(false)
      void loadData()
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo guardar el método de envío.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenantId || !confirmDelete) return
    try {
      await deleteShippingMethod(tenantId, confirmDelete.id)
      toast.show({ title: 'Método eliminado', message: 'El método de envío ha sido eliminado.', variant: 'success' })
      setConfirmDelete(null)
      void loadData()
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No se pudo eliminar el método. Podría tener tarifas asociadas.'),
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
        (r.estimatedDays && r.estimatedDays.toLowerCase().includes(q))
    )
  }, [rows, search])

  const totalCount = rows.length
  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])

  const columns: ColumnDef<MethodRow>[] = useMemo(
    () => [
      {
        key: 'code',
        header: 'Código',
        width: 140,
        renderCell: (_val, row: MethodRow) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={15} style={{ color: 'var(--glb-primary, #0284c7)' }} aria-hidden />
            <span style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{row.code}</span>
          </div>
        ),
      },
      {
        key: 'name',
        header: 'Transportista / Courier',
        width: 220,
        renderCell: (_val, row: MethodRow) => (
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
        key: 'estimatedDays',
        header: 'Tiempo Estimado',
        width: 150,
        renderCell: (_val, row: MethodRow) => (
          <span style={{ fontSize: '0.85rem' }}>
            {row.estimatedDays || '—'}
          </span>
        ),
      },
      {
        key: 'sortOrder',
        header: 'Orden',
        width: 80,
        align: 'center',
        renderCell: (_val, row: MethodRow) => <span>{row.sortOrder}</span>,
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 90,
        align: 'center',
        renderCell: (_val, row: MethodRow) => (
          <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
            {row.isActive ? 'Activo' : 'Inactivo'}
          </StatusBadge>
        ),
      },
      {
        key: 'actions',
        header: 'Acciones',
        sticky: 'right',
        width: 100,
        align: 'center',
        renderCell: (_val: unknown, row: MethodRow) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            {canManage && (
              <GridIconButton
                label="Editar método"
                icon={Pencil}
                onClick={() => openEditModal(row)}
              />
            )}
            {canManage && (
              <GridIconButton
                label="Eliminar método"
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
      <TenantSessionGate title="Métodos de Envío" lead="Transportistas y modalidades de despacho.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de ecommerce o catálogo para ver los métodos de envío."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Métodos de Envío" lead="Transportistas y modalidades de despacho.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Métodos de Envío"
          subtitle="Configura los couriers y modalidades de entrega (ej: Servientrega, Cooperativa de Transporte, Entrega Local, Tramaco)."
          actions={
            canManage ? (
              <Button variant="primary" iconLeft={<Plus size={16} />} onClick={openCreateModal}>
                + Nuevo Método
              </Button>
            ) : undefined
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de métodos">
          <StatCard label="Total de métodos" value={totalCount} />
          <StatCard label="Métodos activos" value={activeCount} />
        </div>

        <SectionCard
          title="Transportistas y Couriers registrados"
          subtitle="Opciones de transporte utilizadas para calcular tarifas y generar guías de remisión."
        >
          {error ? (
            <p className="welcome-onboarding__error" role="alert">
              {error}
            </p>
          ) : null}

          <DataGrid<MethodRow>
            className="ecu-companies-grid"
            dataSource={filteredRows as MethodRow[]}
            keyExpr="id"
            columns={columns}
            selectionMode="none"
            showSearch={false}
            toolbarLeft={
              <div style={{ minWidth: 260, maxWidth: 360, width: '100%' }}>
                <TextBox
                  id="sm-search"
                  label="Buscar método"
                  labelPosition="outlined"
                  variant="outline"
                  value={search}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  placeholder="Buscar por código, nombre o tiempo…"
                  fullWidth
                />
              </div>
            }
            toolbarRight={
              <div className="ecu-grid-toolbar-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                {canManage ? (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={openCreateModal}>
                    + Nuevo Método
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
                title="No hay métodos de envío configurados"
                description="Registra tus transportistas para asociarlos a tarifas por zona y volumen."
                action={
                  canManage ? (
                    <Button variant="primary" onClick={openCreateModal}>
                      + Crear Método de Envío
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
          title={editingMethod ? 'Editar Método de Envío' : 'Nuevo Método de Envío'}
          width="min(92vw, 34rem)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.75rem 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <div>
                <TextBox
                  id="sm-code"
                  label="Código *"
                  labelPosition="outlined"
                  variant="outline"
                  value={formCode}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="SERVIENTREGA, LOCAL"
                  fullWidth
                  disabled={Boolean(editingMethod)}
                />
              </div>
              <div>
                <TextBox
                  id="sm-name"
                  label="Nombre del Transporte / Courier *"
                  labelPosition="outlined"
                  variant="outline"
                  value={formName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                  placeholder="Servientrega Nacional, Cooperativa…"
                  fullWidth
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <TextBox
                  id="sm-estimated"
                  label="Tiempo Estimado de Entrega"
                  labelPosition="outlined"
                  variant="outline"
                  value={formEstimatedDays}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormEstimatedDays(e.target.value)}
                  placeholder="24h, 24 a 48 horas, Mismo día"
                  fullWidth
                />
              </div>
              <div>
                <NumberBox
                  id="sm-order"
                  label="Orden de visualización"
                  labelPosition="outlined"
                  variant="outline"
                  value={formSortOrder}
                  step={1}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormSortOrder(Number(e.target.value) || 0)}
                  fullWidth
                />
              </div>
            </div>

            <div>
              <TextBox
                id="sm-desc"
                label="Descripción / Condiciones de entrega"
                labelPosition="outlined"
                variant="outline"
                value={formDescription}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormDescription(e.target.value)}
                placeholder="Entrega a domicilio, retiro en terminal, etc."
                fullWidth
              />
            </div>

            {editingMethod ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <CheckButton
                  id="sm-active"
                  variant="ghost"
                  checked={formIsActive}
                  onChange={(checked: boolean) => setFormIsActive(checked)}
                >
                  {formIsActive ? 'Método activo' : 'Método inactivo'}
                </CheckButton>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando...' : editingMethod ? 'Actualizar Método' : 'Crear Método'}
              </Button>
            </div>
          </div>
        </Popup>

        {/* Modal Confirmar Eliminación */}
        <Popup
          open={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          title="Eliminar Método de Envío"
          width="min(92vw, 28rem)"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              ¿Estás seguro de que deseas eliminar el método <strong>{confirmDelete?.name}</strong> ({confirmDelete?.code})?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.5rem' }}>
              Esta acción no se puede deshacer. Las reglas de flete que utilicen este transportista deberán reasignarse.
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
