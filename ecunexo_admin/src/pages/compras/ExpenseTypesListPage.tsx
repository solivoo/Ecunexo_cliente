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
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createExpenseType,
  deleteExpenseType,
  listExpenseTypes,
  seedDefaultExpenseTypes,
  updateExpenseType,
} from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { ExpenseTypeModal } from '@/pages/compras/ExpenseTypeModal'
import { findAirConcept } from '@/lib/sriAirCatalog'
import type {
  CreateExpenseTypePayload,
  ExpenseTypeDto,
  UpdateExpenseTypePayload,
} from '@/types/purchasesApi'
import '@/pages/repairs/ecu-customer-form.css'

type ExpenseRow = ExpenseTypeDto & Record<string, unknown>

function formatSustento(code: string): string {
  switch (code) {
    case '01':
      return '01 — Crédito Tributario IVA (Bienes/Servicios)'
    case '02':
      return '02 — Costo o Gasto para Impuesto a la Renta'
    case '03':
      return '03 — Activo Fijo (Crédito Tributario)'
    case '04':
      return '04 — Liquidación de Compra (Sector Agropecuario/Artesanal)'
    case '05':
      return '05 — Liquidación de Compra por Reembolso'
    case '06':
      return '06 — Costo o Gasto con Devolución de IVA'
    case '07':
      return '07 — Gastos de Viaje y Hospedaje'
    case '08':
      return '08 — Arrendamiento Mercantil'
    default:
      return `${code} — Sustento ATS SRI`
  }
}

export function ExpenseTypesListPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('purchases.expenses.read') || useHasPermission('purchases.expenses.manage')
  const canManage = useHasPermission('purchases.expenses.manage')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeDto[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpenseType, setEditingExpenseType] = useState<ExpenseTypeDto | null>(null)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let data = await listExpenseTypes(tenantId)
      // Siembra automática inicial única si la empresa no tiene categorías registradas
      if (data.length === 0 && canManage) {
        const count = await seedDefaultExpenseTypes(tenantId)
        if (count > 0) {
          data = await listExpenseTypes(tenantId)
        }
      }
      setExpenseTypes(data)
    } catch (err) {
      toast.show({
        title: 'Error de carga',
        message: readApiError(err, 'No se pudieron cargar las categorías de compra.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, canManage, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const openCreate = useCallback(() => {
    setEditingExpenseType(null)
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((type: ExpenseTypeDto) => {
    setEditingExpenseType(type)
    setModalOpen(true)
  }, [])

  const handleSave = useCallback(
    async (payload: CreateExpenseTypePayload | UpdateExpenseTypePayload) => {
      if (!tenantId) return
      setSaving(true)
      try {
        if (editingExpenseType) {
          await updateExpenseType(tenantId, editingExpenseType.id, payload as UpdateExpenseTypePayload)
          toast.show({
            title: 'Categoría actualizada',
            message: `El concepto "${payload.name}" se actualizó correctamente.`,
            variant: 'success',
          })
        } else {
          await createExpenseType(tenantId, payload as CreateExpenseTypePayload)
          toast.show({
            title: 'Categoría creada',
            message: `El concepto "${payload.name}" fue agregado al catálogo.`,
            variant: 'success',
          })
        }
        setModalOpen(false)
        await loadData()
      } catch (err) {
        throw new Error(readApiError(err, 'No se pudo guardar la categoría de compra.'))
      } finally {
        setSaving(false)
      }
    },
    [tenantId, editingExpenseType, loadData, toast]
  )

  const handleDelete = useCallback(
    async (row: ExpenseTypeDto) => {
      if (!tenantId) return

      if (row.isSystem) {
        const confirmDeactivate = window.confirm(
          `Los conceptos base del SRI no pueden eliminarse físicamente para proteger las validaciones del ATS.\n\n¿Deseas desactivar el concepto "${row.name}" (${row.code}) para que no aparezca en nuevas compras?`
        )
        if (!confirmDeactivate) return

        try {
          await updateExpenseType(tenantId, row.id, {
            name: row.name,
            isActive: false,
          })
          toast.show({
            title: 'Concepto desactivado',
            message: `"${row.name}" quedó inactivo para nuevas compras.`,
            variant: 'info',
          })
          await loadData()
        } catch (err) {
          toast.show({
            title: 'Error',
            message: readApiError(err, 'No se pudo desactivar el concepto.'),
            variant: 'error',
          })
        }
        return
      }

      const confirmed = window.confirm(
        `¿Eliminar la categoría "${row.name}" (${row.code})?\n\nSi ya está asociada a facturas existentes, se desactivará automáticamente para preservar el histórico contable.`
      )
      if (!confirmed) return

      try {
        await deleteExpenseType(tenantId, row.id)
        toast.show({
          title: 'Categoría removida',
          message: `El concepto "${row.name}" fue retirado del catálogo.`,
          variant: 'success',
        })
        await loadData()
      } catch (err) {
        toast.show({
          title: 'Error al eliminar',
          message: readApiError(err, 'No se pudo retirar la categoría.'),
          variant: 'error',
        })
      }
    },
    [tenantId, loadData, toast]
  )

  const stats = useMemo(() => {
    const total = expenseTypes.length
    const inventariables = expenseTypes.filter((e) => e.affectsInventory).length
    const noInventariables = expenseTypes.filter((e) => !e.affectsInventory).length
    const sistema = expenseTypes.filter((e) => e.isSystem).length
    return { total, inventariables, noInventariables, sistema }
  }, [expenseTypes])

  const columns = useMemo((): ColumnDef<ExpenseRow>[] => {
    return [
      {
        key: 'code',
        header: 'Código',
        width: 120,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => <code className="ecu-code">{row.code}</code>,
      },
      {
        key: 'name',
        header: 'Categoría / Concepto',
        width: 250,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => (
          <div>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
            {row.description ? (
              <div className="ecu-clip" title={row.description}>
                {row.description}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'sriSustentoCode',
        header: 'Sustento ATS (Tabla 5)',
        width: 240,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => (
          <span className="ecu-clip" title={formatSustento(row.sriSustentoCode)}>
            {formatSustento(row.sriSustentoCode)}
          </span>
        ),
      },
      {
        key: 'affectsInventory',
        header: 'Afecta Stock',
        width: 130,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => (
          <span
            className={`ecu-status ${row.affectsInventory ? 'ecu-status--active' : 'ecu-status--inactive'}`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {row.affectsInventory ? 'Sí (Kárdex)' : 'No (Gasto)'}
          </span>
        ),
      },
      {
        key: 'suggestedRetentionCode',
        header: 'Retención AIR (IR)',
        width: 210,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => {
          const air = findAirConcept(row.suggestedRetentionCode)
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <code className="ecu-code">
                  {row.suggestedRetentionCode ? `AIR ${row.suggestedRetentionCode}` : '—'}
                </code>
                {row.retentionPercentage != null ? (
                  <span className="ecu-source">
                    ({row.retentionPercentage.toFixed(2)}%)
                  </span>
                ) : null}
              </div>
              {air ? (
                <div className="ecu-clip" title={air.description}>
                  {air.description}
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        key: 'validFrom',
        header: 'Desde',
        width: 110,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => formatDate(row.validFrom),
      },
      {
        key: 'validUntil',
        header: 'Hasta',
        width: 110,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => formatDate(row.validUntil),
      },
      {
        key: 'isSystem',
        header: 'Origen',
        width: 120,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) =>
          row.isSystem ? (
            <span className="ecu-chip">Catálogo SRI</span>
          ) : (
            <span className="ecu-chip ecu-chip--muted">Personalizado</span>
          ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 100,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => (
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
        renderCell: (_value: unknown, row: ExpenseRow) => {
          if (!canManage) return null
          return (
            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
              <GridIconButton
                label="Editar categoría"
                icon={Pencil}
                onClick={() => openEdit(row)}
              />
              <GridIconButton
                label={row.isSystem ? 'Desactivar concepto base' : 'Eliminar categoría'}
                icon={Trash2}
                danger={!row.isSystem}
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
  } = useGluDataGridPaging(expenseTypes.length)

  const messages = useMemo(() => createSpanishDataGridMessages('categoría', 'categorías'), [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Categorías de Compra" lead="Catálogo de sustentación tributaria ATS.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de compras para ver el catálogo de categorías."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Categorías de Compra SRI"
      lead="Deducción tributaria, sustento ATS Tabla 5, porcentaje de retención en la fuente (AIR) y afectación de inventario."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Categorías de Compra y Sustentos SRI"
          subtitle="Conceptos de compra con sustento ATS, retención AIR y afectación de inventario."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de categorías de compra">
          <StatCard label="Total Conceptos" value={stats.total} />
          <StatCard label="Afectan Inventario" value={stats.inventariables} />
          <StatCard label="Servicios y Gastos" value={stats.noInventariables} />
          <StatCard label="Catálogo SRI" value={stats.sistema} />
        </div>

        <SectionCard title="Catálogo de Categorías y Conceptos">
          {!loading && expenseTypes.length === 0 ? (
            <EmptyState
              icon="category"
              title="No hay categorías de compra registradas"
              description="Crea una categoría de compra para clasificar tus adquisiciones y deducciones tributarias ATS."
              action={
                canManage ? (
                  <Button variant="primary" onClick={openCreate}>
                    <Plus size={16} />
                    Nueva Categoría
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              dataSource={expenseTypes as ExpenseRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={300}
              searchPlaceholder="Buscar concepto, código, sustento..."
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                  {canManage && (
                    <Button variant="primary" onClick={openCreate}>
                      <Plus size={16} />
                      Nueva Categoría
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

        {/* Modal de Crear / Editar Categoría */}
        <ExpenseTypeModal
          open={modalOpen}
          expenseType={editingExpenseType}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      </div>
    </TenantSessionGate>
  )
}

export default ExpenseTypesListPage
