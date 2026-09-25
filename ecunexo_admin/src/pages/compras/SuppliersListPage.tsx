import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  DataGrid,
  useToast,
  type ColumnDef,
} from 'glubox'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  GridToolbarRefresh,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createSupplier,
  deleteSupplier,
  listExpenseTypes,
  listSuppliers,
  updateSupplier,
} from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { SupplierModal } from '@/pages/compras/SupplierModal'
import type {
  CreateSupplierPayload,
  ExpenseTypeDto,
  SupplierDto,
  SupplierTaxRegime,
  UpdateSupplierPayload,
} from '@/types/purchasesApi'
import '@/pages/repairs/ecu-customer-form.css'

type SupplierRow = SupplierDto & Record<string, unknown>

function formatRegime(regime: SupplierTaxRegime): string {
  switch (regime) {
    case 1:
      return 'General'
    case 2:
      return 'RIMPE Emprendedor'
    case 3:
      return 'RIMPE Popular'
    case 4:
      return 'Contrib. Especial'
    case 5:
      return 'Entidad Pública'
    default:
      return 'General'
  }
}

export function SuppliersListPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('purchases.suppliers.read') || useHasPermission('purchases.suppliers.manage')
  const canManage = useHasPermission('purchases.suppliers.manage')

  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeDto[]>([])
  const [activeOnly] = useState<boolean | undefined>(undefined)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierDto | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [suppliersData, expenseTypesData] = await Promise.all([
        listSuppliers(tenantId, { activeOnly }),
        listExpenseTypes(tenantId, true).catch(() => []),
      ])
      setSuppliers(suppliersData)
      setExpenseTypes(expenseTypesData)
    } catch (err) {
      toast.show({
        title: 'Error de carga',
        message: readApiError(err, 'No se pudo cargar el directorio de proveedores.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, activeOnly, toast])

  const expenseTypeMap = useMemo(() => {
    const map = new Map<string, ExpenseTypeDto>()
    for (const et of expenseTypes) {
      map.set(et.id, et)
    }
    return map
  }, [expenseTypes])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const openCreate = useCallback(() => {
    setEditingSupplier(null)
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((supplier: SupplierDto) => {
    setEditingSupplier(supplier)
    setModalOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (supplier: SupplierDto) => {
      if (!tenantId) return
      const confirmed = window.confirm(
        `¿Dar de baja al proveedor "${supplier.businessName}"? Las compras y proformas históricas se mantendrán preservadas.`
      )
      if (!confirmed) return

      try {
        await deleteSupplier(tenantId, supplier.id)
        toast.show({
          title: 'Proveedor retirado',
          message: `El proveedor "${supplier.businessName}" fue dado de baja.`,
          variant: 'success',
        })
        await loadData()
      } catch (err) {
        toast.show({
          title: 'Error al eliminar',
          message: readApiError(err, 'No se pudo dar de baja al proveedor.'),
          variant: 'error',
        })
      }
    },
    [tenantId, loadData, toast]
  )

  const handleSave = useCallback(
    async (payload: CreateSupplierPayload | UpdateSupplierPayload) => {
      if (!tenantId) return
      setSaving(true)
      try {
        if (editingSupplier) {
          await updateSupplier(tenantId, editingSupplier.id, payload as UpdateSupplierPayload)
          toast.show({
            title: 'Proveedor actualizado',
            message: `Los datos de "${payload.businessName}" se actualizaron correctamente.`,
            variant: 'success',
          })
        } else {
          await createSupplier(tenantId, payload as CreateSupplierPayload)
          toast.show({
            title: 'Proveedor registrado',
            message: `"${payload.businessName}" ha sido registrado en el directorio.`,
            variant: 'success',
          })
        }
        setModalOpen(false)
        await loadData()
      } catch (err) {
        throw new Error(readApiError(err, 'No se pudo guardar el proveedor.'))
      } finally {
        setSaving(false)
      }
    },
    [tenantId, editingSupplier, loadData, toast]
  )

  // KPIs
  const stats = useMemo(() => {
    const total = suppliers.length
    const activos = suppliers.filter((s) => s.isActive).length
    const agentesRetencion = suppliers.filter((s) => s.isRetentionAgent).length
    const rimpe = suppliers.filter((s) => s.taxRegime === 2 || s.taxRegime === 3).length
    return { total, activos, agentesRetencion, rimpe }
  }, [suppliers])

  // DataGrid Columns
  const columns = useMemo((): ColumnDef<SupplierRow>[] => {
    return [
      {
        key: 'businessName',
        header: 'Razón Social / Comercial',
        width: 280,
        sortable: true,
        renderCell: (_value, row: SupplierRow) => (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--glb-text, #111827)' }}>
              {row.businessName}
            </div>
            {row.tradeName ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #6b7280)' }}>
                {row.tradeName}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'taxId',
        header: 'RUC / Identificación',
        width: 160,
        sortable: true,
        renderCell: (_value, row: SupplierRow) => (
          <div>
            <code className="ecu-code">{row.taxId}</code>
            <div className="ecu-source">
              {row.identificationType === 1 ? 'RUC' : row.identificationType === 2 ? 'Cédula' : 'Pasaporte'}
            </div>
          </div>
        ),
      },
      {
        key: 'taxRegime',
        header: 'Régimen SRI',
        width: 170,
        sortable: true,
        renderCell: (_value, row: SupplierRow) => (
          <span className="ecu-chip">{formatRegime(row.taxRegime)}</span>
        ),
      },
      {
        key: 'isRetentionAgent',
        header: 'Agente Retención',
        width: 150,
        sortable: true,
        renderCell: (_value, row: SupplierRow) => (
          <span
            className={`ecu-status ${row.isRetentionAgent ? 'ecu-status--active' : 'ecu-status--inactive'}`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {row.isRetentionAgent ? 'Agente SRI' : 'No'}
          </span>
        ),
      },
      {
        key: 'contactEmail',
        header: 'Contacto',
        width: 220,
        renderCell: (_value: unknown, row: SupplierRow) => (
          <div style={{ fontSize: '0.8rem' }}>
            {row.contactEmail ? <div className="ecu-clip">{row.contactEmail}</div> : null}
            {row.contactPhone ? (
              <div style={{ color: 'var(--glb-muted, #6b7280)' }}>{row.contactPhone}</div>
            ) : null}
            {!row.contactEmail && !row.contactPhone ? (
              <span style={{ color: 'var(--glb-muted, #9ca3af)' }}>Sin contacto</span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'creditDays',
        header: 'Términos de Pago',
        width: 140,
        sortable: true,
        renderCell: (_value, row: SupplierRow) => (
          <span style={{ fontSize: '0.85rem' }}>
            {row.creditDays > 0 ? `${row.creditDays} días crédito` : 'Contado'}
          </span>
        ),
      },
      {
        key: 'defaultExpenseTypeId',
        header: 'Gasto / Servicio Predeterminado',
        width: 210,
        renderCell: (_value, row: SupplierRow) => {
          if (!row.defaultExpenseTypeId) {
            return (
              <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #9ca3af)' }}>
                Detección auto
              </span>
            )
          }
          const et = expenseTypeMap.get(row.defaultExpenseTypeId)
          if (!et) {
            return <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #9ca3af)' }}>—</span>
          }
          return (
            <div>
              <div className="ecu-clip" style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--glb-text, #111827)' }} title={et.name}>
                {et.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--glb-muted, #6b7280)' }}>
                {et.affectsInventory ? 'Inventario' : 'Gasto/Servicio'}
              </div>
            </div>
          )
        },
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 110,
        sortable: true,
        renderCell: (_value, row: SupplierRow) => (
          <span className={`ecu-status ${row.isActive ? 'ecu-status--active' : 'ecu-status--inactive'}`}>
            <span className="ecu-status__dot" aria-hidden />
            {row.isActive ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
      {
        key: 'id',
        header: 'Acciones',
        width: 100,
        sortable: false,
        renderCell: (_value: unknown, row: SupplierRow) => {
          if (!canManage) return null
          return (
            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
              <GridIconButton
                label="Editar proveedor"
                icon={Pencil}
                onClick={() => openEdit(row)}
              />
              <GridIconButton
                label="Dar de baja proveedor"
                icon={Trash2}
                danger
                onClick={() => void handleDelete(row)}
              />
            </div>
          )
        },
      },
    ]
  }, [canManage, openEdit, handleDelete])

  const {
    paging,
    pageSizeOptions,
    onPageChange,
    onPageSizeChange,
  } = useGluDataGridPaging(suppliers.length)

  const messages = useMemo(() => createSpanishDataGridMessages('proveedor', 'proveedores'), [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Proveedores" lead="Gestión del catálogo y condiciones fiscales de compra.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de compras o facturación para ver el directorio de proveedores."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Directorio de Proveedores"
      lead="Administra proveedores, validaciones tributarias RUC ante SRI y condiciones de crédito para compras."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Directorio de Proveedores"
          subtitle="Proveedores registrados con su RUC, régimen SRI y condiciones de crédito."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de proveedores">
          <StatCard label="Total Proveedores" value={stats.total} />
          <StatCard label="Proveedores Activos" value={stats.activos} />
          <StatCard label="Agentes de Retención" value={stats.agentesRetencion} />
          <StatCard label="Régimen RIMPE" value={stats.rimpe} />
        </div>

        <SectionCard title="Listado de Proveedores">
          {!loading && suppliers.length === 0 ? (
            <EmptyState
              icon="local_shipping"
              title="No hay proveedores registrados"
              description="Registra a tus proveedores para asociar proformas de compra, facturas recibidas y retenciones SRI."
              action={
                canManage ? (
                  <Button variant="primary" onClick={openCreate}>
                    <Plus size={16} />
                    Registrar Primer Proveedor
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              dataSource={suppliers as SupplierRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={300}
              searchPlaceholder="Buscar por razón social, RUC..."
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                  {canManage && (
                    <Button variant="primary" onClick={openCreate}>
                      <Plus size={16} />
                      Nuevo Proveedor
                    </Button>
                  )}
                </div>
              }
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>

        <SupplierModal
          open={modalOpen}
          supplier={editingSupplier}
          saving={saving}
          expenseTypes={expenseTypes}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      </div>
    </TenantSessionGate>
  )
}

export default SuppliersListPage
