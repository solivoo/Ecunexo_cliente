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
import { Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
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

function formatValidity(validFrom: string | null, validUntil: string | null): string {
  if (!validFrom && !validUntil) return 'Indefinida'
  if (validFrom && !validUntil) return `Desde ${validFrom}`
  if (!validFrom && validUntil) return `Hasta ${validUntil}`
  return `${validFrom} — ${validUntil}`
}

export function ExpenseTypesListPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('purchases.expenses.read') || useHasPermission('purchases.expenses.manage')
  const canManage = useHasPermission('purchases.expenses.manage')

  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeDto[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpenseType, setEditingExpenseType] = useState<ExpenseTypeDto | null>(null)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await listExpenseTypes(tenantId)
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
  }, [tenantId, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSeedDefaults = useCallback(async () => {
    if (!tenantId) return
    setSeeding(true)
    try {
      const count = await seedDefaultExpenseTypes(tenantId)
      if (count > 0) {
        toast.show({
          title: 'Catálogo SRI sembrado',
          message: `Se crearon ${count} conceptos estándar de compras y retenciones SRI.`,
          variant: 'success',
        })
      } else {
        toast.show({
          title: 'Catálogo existente',
          message: 'La empresa ya cuenta con categorías de compra configuradas.',
          variant: 'info',
        })
      }
      await loadData()
    } catch (err) {
      toast.show({
        title: 'Error al sembrar',
        message: readApiError(err, 'No se pudo inicializar el catálogo de categorías.'),
        variant: 'error',
      })
    } finally {
      setSeeding(false)
    }
  }, [tenantId, loadData, toast])

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
        renderCell: (_value, row: ExpenseRow) => (
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.code}</span>
        ),
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
              <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #6b7280)' }}>
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
          <span style={{ fontSize: '0.8rem' }}>{formatSustento(row.sriSustentoCode)}</span>
        ),
      },
      {
        key: 'affectsInventory',
        header: 'Afecta Stock',
        width: 130,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) =>
          row.affectsInventory ? (
            <StatusBadge tone="success">Sí (Kárdex)</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">No (Gasto)</StatusBadge>
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
                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.825rem' }}>
                  {row.suggestedRetentionCode ? `AIR ${row.suggestedRetentionCode}` : '—'}
                </span>
                {row.retentionPercentage != null ? (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: row.retentionPercentage === 0 ? 'var(--glb-muted, #6b7280)' : 'var(--shell-primary, #2563eb)',
                    }}
                  >
                    ({row.retentionPercentage.toFixed(2)}%)
                  </span>
                ) : null}
              </div>
              {air ? (
                <div
                  title={air.description}
                  style={{
                    fontSize: '0.725rem',
                    color: 'var(--glb-muted, #6b7280)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '12rem',
                  }}
                >
                  {air.description}
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        key: 'validFrom',
        header: 'Vigencia SRI',
        width: 150,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => (
          <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #6b7280)' }}>
            {formatValidity(row.validFrom, row.validUntil)}
          </span>
        ),
      },
      {
        key: 'isSystem',
        header: 'Origen',
        width: 120,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) =>
          row.isSystem ? (
            <StatusBadge tone="info">Catálogo SRI</StatusBadge>
          ) : (
            <StatusBadge tone="primary">Personalizado</StatusBadge>
          ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 100,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => (
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
        <div className="ecu-dashboard-layout">
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
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Categorías de Compra y Sustentos SRI"
          subtitle="Conceptos esenciales para clasificar compras de bienes y servicios, asignación de crédito tributario ATS, tarifas de retención en la fuente (AIR) y vigencia oficial."
          badge={
            <StatusBadge tone="primary" withDot>
              Módulo Compras
            </StatusBadge>
          }
          actions={
            canManage ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="primary" onClick={openCreate}>
                  <Plus size={16} />
                  Nueva Categoría
                </Button>
                {expenseTypes.length === 0 && (
                  <Button variant="outline" onClick={() => void handleSeedDefaults()} disabled={seeding}>
                    <Sparkles size={16} />
                    {seeding ? 'Sembrando...' : 'Sembrar Estándar SRI'}
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de categorías de compra">
          <StatCard
            label="Total Conceptos"
            value={String(stats.total)}
            icon="category"
            toneColor="#4f46e5"
            footerText="Categorías configuradas"
          />
          <StatCard
            label="Afectan Inventario"
            value={String(stats.inventariables)}
            icon="inventory_2"
            toneColor="#10b981"
            footerText="Mercadería y productos físicos"
          />
          <StatCard
            label="Servicios y Gastos"
            value={String(stats.noInventariables)}
            icon="receipt_long"
            toneColor="#0ea5e9"
            footerText="Honorarios, fletes, arriendos"
          />
          <StatCard
            label="Semillero SRI"
            value={String(stats.sistema)}
            icon="verified_user"
            toneColor="#8b5cf6"
            footerText="Catálogo ATS agosto 2026"
          />
        </div>

        <SectionCard
          title="Catálogo de Categorías y Conceptos"
          subtitle="Mapeo directo de compras al Anexo Transaccional Simplificado (ATS), retención en la fuente (AIR) y vigencias normativas"
          action={
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSeedDefaults()}
                  disabled={seeding || loading}
                >
                  <Sparkles size={14} />
                  Sembrar Estándar SRI
                </Button>
              )}
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
          {!loading && expenseTypes.length === 0 ? (
            <EmptyState
              icon="category"
              title="No hay categorías de compra registradas"
              description="Siembra el catálogo estándar del SRI con los 9 conceptos esenciales (mercaderías, mano de obra, honorarios, arriendos, transporte, publicidad, RIMPE) o crea uno nuevo."
              action={
                canManage ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button variant="primary" onClick={() => void handleSeedDefaults()} disabled={seeding}>
                      <Sparkles size={16} />
                      {seeding ? 'Sembrando catálogo...' : 'Sembrar Catálogo Estándar SRI'}
                    </Button>
                    <Button variant="outline" onClick={openCreate}>
                      <Plus size={16} />
                      Nueva Categoría
                    </Button>
                  </div>
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
