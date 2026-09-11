import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  CheckButton,
  DataGrid,
  Popup,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
  type PageActionItem,
} from 'glubox'
import {
  EcuPageActions,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createCustomerType,
  deleteCustomerType,
  listCustomerTypes,
  updateCustomerType,
} from '@/services/customersApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  normalizeCustomerTypeTone,
  type CustomerTypeDefinitionDto,
} from '@/types/customersApi'
import '@/pages/repairs/ecu-customer-form.css'

type TypeRow = CustomerTypeDefinitionDto & Record<string, unknown>

const TONE_OPTIONS = [
  { value: 'primary', label: 'Primario' },
  { value: 'success', label: 'Éxito' },
  { value: 'warning', label: 'Advertencia' },
  { value: 'neutral', label: 'Neutro' },
  { value: 'info', label: 'Información' },
]

export default function CustomerTypesListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('customers.read') || useHasPermission('customers.manage')
  const canManage = useHasPermission('customers.manage')

  const [rows, setRows] = useState<CustomerTypeDefinitionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerTypeDefinitionDto | null>(null)
  const [name, setName] = useState('')
  const [shortLabel, setShortLabel] = useState('')
  const [tone, setTone] = useState('primary')
  const [sortOrder, setSortOrder] = useState('100')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<CustomerTypeDefinitionDto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listCustomerTypes(tenantId, false))
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Tipos de cliente sincronizados.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar los tipos de cliente.')
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
    if (canRead) void load({ silent: true })
  }, [canRead, load])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setShortLabel('')
    setTone('primary')
    setSortOrder('100')
    setIsActive(true)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: CustomerTypeDefinitionDto) => {
    setEditing(row)
    setName(row.name)
    setShortLabel(row.shortLabel)
    setTone(normalizeCustomerTypeTone(row.tone))
    setSortOrder(String(row.sortOrder))
    setIsActive(row.isActive)
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setFormError(null)
  }

  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!tenantId || !canManage) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('El nombre del tipo es obligatorio.')
      return
    }

    const parsedSort = Number.parseInt(sortOrder, 10)
    if (!Number.isFinite(parsedSort)) {
      setFormError('El orden debe ser un número entero.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const short = shortLabel.trim() || trimmedName
      if (editing) {
        const updated = await updateCustomerType(tenantId, editing.id, {
          name: trimmedName,
          shortLabel: short,
          tone,
          sortOrder: parsedSort,
          isActive,
        })
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        toast.show({
          title: 'Tipo actualizado',
          message: `«${updated.name}» se guardó correctamente.`,
          variant: 'success',
        })
      } else {
        const created = await createCustomerType(tenantId, {
          name: trimmedName,
          shortLabel: short,
          tone,
          sortOrder: parsedSort,
        })
        setRows((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
        toast.show({
          title: 'Tipo creado',
          message: `«${created.name}» está disponible en el directorio.`,
          variant: 'success',
        })
      }
      setModalOpen(false)
    } catch (err: unknown) {
      setFormError(readApiError(err, 'No fue posible guardar el tipo de cliente.'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (row: CustomerTypeDefinitionDto) => {
    if (!tenantId || !canManage) return
    try {
      const updated = await updateCustomerType(tenantId, row.id, {
        name: row.name,
        shortLabel: row.shortLabel,
        tone: row.tone,
        sortOrder: row.sortOrder,
        isActive: !row.isActive,
      })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.show({
        title: updated.isActive ? 'Tipo activado' : 'Tipo desactivado',
        message: `«${row.name}» ahora está ${updated.isActive ? 'activo' : 'inactivo'}.`,
        variant: 'info',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo cambiar el estado del tipo.'),
        variant: 'error',
      })
    }
  }

  const handleDelete = async () => {
    if (!tenantId || !canManage || !confirmDelete) return
    setDeletingId(confirmDelete.id)
    try {
      await deleteCustomerType(tenantId, confirmDelete.id)
      setRows((prev) => prev.filter((r) => r.id !== confirmDelete.id))
      toast.show({
        title: 'Tipo eliminado',
        message: `«${confirmDelete.name}» quedó dado de baja.`,
        variant: 'success',
      })
      setConfirmDelete(null)
    } catch (err: unknown) {
      toast.show({
        title: 'No se pudo eliminar',
        message: readApiError(err, 'Los tipos de sistema no se pueden eliminar.'),
        variant: 'error',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const stats = useMemo(() => {
    const total = rows.length
    const active = rows.filter((r) => r.isActive).length
    const custom = rows.filter((r) => !r.isSystem).length
    const system = total - custom
    return { total, active, custom, system }
  }, [rows])

  const messages = useMemo(() => createSpanishDataGridMessages('tipo', 'tipos'), [])
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging(10)

  const actionItems = useMemo((): PageActionItem[] => {
    return [
      {
        id: 'directory',
        label: 'Directorio',
        icon: 'users',
        route: '/clientes',
        disabled: false,
      },
      {
        id: 'refresh',
        label: 'Actualizar',
        icon: 'refresh-cw',
        disabled: loading,
      },
    ]
  }, [loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') void load()
    },
    [load]
  )

  const columns = useMemo(
    (): ColumnDef<TypeRow>[] => [
      {
        key: 'name',
        header: 'Tipo',
        width: 280,
        sortable: true,
        renderCell: (_v, row: TypeRow) => (
          <div className="flex flex-col py-1 gap-0.5">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</span>
            <span className="text-xs text-slate-500">Código {row.code}</span>
          </div>
        ),
      },
      {
        key: 'shortLabel',
        header: 'Etiqueta',
        width: 160,
        sortable: true,
        renderCell: (_v, row: TypeRow) => (
          <StatusBadge tone={normalizeCustomerTypeTone(row.tone)} withDot>
            {row.shortLabel}
          </StatusBadge>
        ),
      },
      {
        key: 'isSystem',
        header: 'Origen',
        width: 120,
        sortable: true,
        renderCell: (_v, row: TypeRow) => (
          <StatusBadge tone={row.isSystem ? 'primary' : 'info'}>
            {row.isSystem ? 'Sistema' : 'Personalizado'}
          </StatusBadge>
        ),
      },
      {
        key: 'sortOrder',
        header: 'Orden',
        width: 90,
        sortable: true,
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 110,
        sortable: true,
        renderCell: (_v, row: TypeRow) => (
          <StatusBadge tone={row.isActive ? 'success' : 'neutral'} withDot>
            {row.isActive ? 'Activo' : 'Inactivo'}
          </StatusBadge>
        ),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: canManage ? 140 : 72,
        sortable: false,
        renderCell: (_v, row: TypeRow) =>
          canManage ? (
            <div className="flex items-center gap-1.5 py-1">
              <GridIconButton label="Editar tipo" icon={Pencil} onClick={() => openEdit(row)} />
              <GridIconButton
                label={row.isActive ? 'Desactivar tipo' : 'Activar tipo'}
                icon={Power}
                onClick={() => void handleToggleActive(row)}
              />
              {!row.isSystem ? (
                <GridIconButton
                  label="Eliminar tipo"
                  icon={Trash2}
                  onClick={() => setConfirmDelete(row)}
                />
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
    ],
    [canManage]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Tipos de cliente" lead="Clasificación comercial del directorio.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres customers.read o customers.manage para consultar los tipos."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Tipos de cliente"
      lead="Clasificaciones comerciales usadas en el directorio, facturación y taller."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Tipos de Cliente"
          subtitle="Define y mantiene las clasificaciones del directorio comercial. Los tipos de sistema se pueden desactivar pero no eliminar."
          badge={
            <StatusBadge tone="primary" withDot>
              {stats.total} {stats.total === 1 ? 'tipo' : 'tipos'}
            </StatusBadge>
          }
          actions={
            <>
              {canManage && (
                <Button type="button" variant="primary" onClick={openCreate}>
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Nuevo Tipo
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de tipos"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de tipos de cliente">
          <StatCard
            label="Total tipos"
            value={stats.total}
            icon="sell"
            toneColor="#4f46e5"
            footerText="Sistema y personalizados"
          />
          <StatCard
            label="Activos"
            value={stats.active}
            icon="verified"
            toneColor="#10b981"
            footerText="Disponibles al registrar clientes"
          />
          <StatCard
            label="De sistema"
            value={stats.system}
            icon="settings"
            toneColor="#6366f1"
            footerText="Predefinidos por EcuNexo"
          />
          <StatCard
            label="Personalizados"
            value={stats.custom}
            icon="new_label"
            toneColor="#0284c7"
            footerText="Creados por la empresa"
          />
        </div>

        <SectionCard
          title="Catálogo de clasificaciones"
          subtitle="Etiquetas usadas en el directorio y en los selectores de operaciones"
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && rows.length === 0 ? (
            <EmptyState
              icon="sell"
              title="Aún no hay tipos configurados"
              description="Los tipos de sistema se crean automáticamente al entrar. También puedes agregar clasificaciones propias con permiso customers.manage."
              action={
                canManage ? (
                  <Button type="button" variant="primary" onClick={openCreate}>
                    + Nuevo Tipo
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              dataSource={rows as TypeRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar tipo..."
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>

        <Popup
          open={modalOpen}
          title={editing ? 'Editar tipo de cliente' : 'Nuevo tipo de cliente'}
          onClose={closeModal}
          width="min(92vw, 32rem)"
          actions={[
            {
              id: 'cancel',
              label: 'Cancelar',
              variant: 'outline',
              onClick: closeModal,
              disabled: saving,
            },
            {
              id: 'save',
              label: saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear tipo',
              variant: 'primary',
              onClick: () => void handleSave(),
              disabled: saving || !name.trim(),
              loading: saving,
            },
          ]}
        >
          <form onSubmit={handleSave} className="ecu-customer-form" noValidate>
            {formError ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="ecu-customer-form__grid">
              <div className="ecu-customer-form__field ecu-customer-form__field--span">
                <TextBox
                  id="customer-type-name"
                  label="Nombre *"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setName(e.target.value)
                    if (formError) setFormError(null)
                  }}
                  placeholder="Ej. Retail / Cadena"
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div className="ecu-customer-form__field">
                <TextBox
                  id="customer-type-short"
                  label="Etiqueta corta"
                  labelPosition="outlined"
                  variant="outline"
                  value={shortLabel}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setShortLabel(e.target.value)}
                  placeholder="Ej. Retail"
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div className="ecu-customer-form__field">
                <Select
                  id="customer-type-tone"
                  label="Tono visual"
                  labelPosition="outlined"
                  variant="outline"
                  value={tone}
                  onChange={(val: string) => setTone(val)}
                  options={TONE_OPTIONS}
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div className="ecu-customer-form__field">
                <TextBox
                  id="customer-type-sort"
                  label="Orden"
                  labelPosition="outlined"
                  variant="outline"
                  value={sortOrder}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSortOrder(e.target.value)}
                  placeholder="100"
                  fullWidth
                  disabled={saving}
                />
              </div>
            </div>

            {editing ? (
              <div className="ecu-customer-form__status">
                <CheckButton
                  checked={isActive}
                  onChange={(checked: boolean) => setIsActive(checked)}
                  disabled={saving}
                >
                  Tipo activo para nuevos clientes
                </CheckButton>
              </div>
            ) : null}
          </form>
        </Popup>

        <Popup
          open={confirmDelete !== null}
          title="Eliminar tipo"
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
              ¿Dar de baja <strong>{confirmDelete.name}</strong>? Los clientes que ya lo usan
              conservarán el código; no podrás asignarlo a nuevos registros.
            </p>
          ) : null}
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
