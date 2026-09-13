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
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { SupplierModal } from '@/pages/compras/SupplierModal'
import type {
  CreateSupplierPayload,
  SupplierDto,
  SupplierTaxRegime,
  UpdateSupplierPayload,
} from '@/types/purchasesApi'
import '@/pages/repairs/ecu-customer-form.css'

type SupplierRow = SupplierDto & Record<string, unknown>

function formatRegime(regime: SupplierTaxRegime): { label: string; tone: 'primary' | 'success' | 'warning' | 'neutral' | 'info' } {
  switch (regime) {
    case 1:
      return { label: 'General', tone: 'neutral' }
    case 2:
      return { label: 'RIMPE Emprendedor', tone: 'primary' }
    case 3:
      return { label: 'RIMPE Popular', tone: 'info' }
    case 4:
      return { label: 'Contrib. Especial', tone: 'warning' }
    case 5:
      return { label: 'Entidad Pública', tone: 'success' }
    default:
      return { label: 'General', tone: 'neutral' }
  }
}

export function SuppliersListPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('purchases.suppliers.read') || useHasPermission('facturacion.read')
  const canManage = useHasPermission('purchases.suppliers.manage') || useHasPermission('facturacion.read')

  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [activeOnly] = useState<boolean | undefined>(undefined)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierDto | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await listSuppliers(tenantId, { activeOnly })
      setSuppliers(data)
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
            <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{row.taxId}</span>
            <div style={{ fontSize: '0.7rem', color: 'var(--glb-muted, #6b7280)' }}>
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
        renderCell: (_value, row: SupplierRow) => {
          const { label, tone } = formatRegime(row.taxRegime)
          return <StatusBadge tone={tone}>{label}</StatusBadge>
        },
      },
      {
        key: 'isRetentionAgent',
        header: 'Agente Retención',
        width: 150,
        sortable: true,
        renderCell: (_value, row: SupplierRow) =>
          row.isRetentionAgent ? (
            <StatusBadge tone="primary">Agente SRI</StatusBadge>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #9ca3af)' }}>No</span>
          ),
      },
      {
        key: 'contactEmail',
        header: 'Contacto',
        width: 220,
        renderCell: (_value: unknown, row: SupplierRow) => (
          <div style={{ fontSize: '0.8rem' }}>
            {row.contactEmail ? <div>{row.contactEmail}</div> : null}
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
        key: 'isActive',
        header: 'Estado',
        width: 110,
        sortable: true,
        renderCell: (_value, row: SupplierRow) => (
          <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
            {row.isActive ? 'Activo' : 'Inactivo'}
          </StatusBadge>
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
        <div className="ecu-dashboard-layout">
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
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Directorio de Proveedores"
          subtitle="Catálogo maestro de proveedores para facturas de compra, proformas y emisión de retenciones SRI (07)."
          badge={
            <StatusBadge tone="primary" withDot>
              Módulo Compras
            </StatusBadge>
          }
          actions={
            canManage ? (
              <Button variant="primary" onClick={openCreate}>
                <Plus size={16} />
                Nuevo Proveedor
              </Button>
            ) : undefined
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de proveedores">
          <StatCard
            label="Total Proveedores"
            value={String(stats.total)}
            icon="local_shipping"
            toneColor="#4f46e5"
            footerText="Registrados en la empresa"
          />
          <StatCard
            label="Proveedores Activos"
            value={String(stats.activos)}
            icon="verified"
            toneColor="#10b981"
            footerText="Disponibles para compras"
          />
          <StatCard
            label="Agentes de Retención"
            value={String(stats.agentesRetencion)}
            icon="verified_user"
            toneColor="#0ea5e9"
            footerText="Calificados por el SRI"
          />
          <StatCard
            label="Régimen RIMPE"
            value={String(stats.rimpe)}
            icon="sell"
            toneColor="#8b5cf6"
            footerText="Emprendedor y Negocio Popular"
          />
        </div>

        <SectionCard
          title="Listado de Proveedores"
          subtitle="Búsqueda rápida por razón social, nombre comercial o RUC/Cédula"
          action={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadData()}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'ecu-spin' : ''} />
                Actualizar
              </Button>
            </div>
          }
        >
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
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      </div>
    </TenantSessionGate>
  )
}

export default SuppliersListPage
