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
import { RefreshCw, Sparkles } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { listExpenseTypes, seedDefaultExpenseTypes } from '@/services/purchasesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { ExpenseTypeDto } from '@/types/purchasesApi'

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
    default:
      return `${code} — Sustento ATS SRI`
  }
}

export function ExpenseTypesListPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('purchases.expenses.read') || useHasPermission('facturacion.read')
  const canManage = useHasPermission('purchases.expenses.manage') || useHasPermission('facturacion.read')

  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeDto[]>([])

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await listExpenseTypes(tenantId)
      setExpenseTypes(data)
    } catch (err) {
      toast.show({
        title: 'Error de carga',
        message: readApiError(err, 'No se pudieron cargar los tipos de gasto.'),
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
          message: `Se crearon ${count} conceptos estándar de compras y gastos SRI.`,
          variant: 'success',
        })
      } else {
        toast.show({
          title: 'Catálogo existente',
          message: 'La empresa ya cuenta con tipos de gasto configurados.',
          variant: 'info',
        })
      }
      await loadData()
    } catch (err) {
      toast.show({
        title: 'Error al sembrar',
        message: readApiError(err, 'No se pudo inicializar el catálogo de tipos de gasto.'),
        variant: 'error',
      })
    } finally {
      setSeeding(false)
    }
  }, [tenantId, loadData, toast])

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
        header: 'Concepto / Gasto',
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
        header: 'Sustento Tributario SRI (ATS)',
        width: 280,
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
        header: 'Ret. IR Sugerida',
        width: 130,
        sortable: true,
        renderCell: (_value, row: ExpenseRow) => (
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {row.suggestedRetentionCode ? `Código ${row.suggestedRetentionCode}` : '—'}
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
    ]
  }, [])

  const {
    paging,
    pageSizeOptions,
    onPageChange,
    onPageSizeChange,
  } = useGluDataGridPaging(expenseTypes.length)

  const messages = useMemo(() => createSpanishDataGridMessages('concepto', 'conceptos'), [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Tipos de Gasto" lead="Catálogo de sustentación tributaria ATS.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de compras para ver el catálogo de gastos."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Tipos de Gasto SRI"
      lead="Deducción tributaria, sustento ATS Tabla 5 y afectación de inventario para compras."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Tipos de Gasto y Sustentos SRI"
          subtitle="Catálogo oficial de compra y sustento tributario de comprobantes electrónicos de compra y retención en la fuente (07)."
          badge={
            <StatusBadge tone="primary" withDot>
              Módulo Compras
            </StatusBadge>
          }
          actions={
            canManage && expenseTypes.length === 0 ? (
              <Button variant="primary" onClick={() => void handleSeedDefaults()} disabled={seeding}>
                <Sparkles size={16} />
                {seeding ? 'Sembrando...' : 'Sembrar Estándar SRI'}
              </Button>
            ) : undefined
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de tipos de gasto">
          <StatCard
            label="Total Conceptos"
            value={String(stats.total)}
            icon="tags"
            toneColor="#4f46e5"
            footerText="Tipos de compra configurados"
          />
          <StatCard
            label="Afectan Inventario"
            value={String(stats.inventariables)}
            icon="package"
            toneColor="#10b981"
            footerText="Mercadería y materiales"
          />
          <StatCard
            label="Gastos Operativos"
            value={String(stats.noInventariables)}
            icon="receipt"
            toneColor="#0ea5e9"
            footerText="Publicidad, cloud, arriendos"
          />
          <StatCard
            label="Semillero SRI"
            value={String(stats.sistema)}
            icon="shield-check"
            toneColor="#8b5cf6"
            footerText="Oficiales ATS v2.0"
          />
        </div>

        <SectionCard
          title="Catálogo de Conceptos"
          subtitle="Mapeo directo de compras a la Ficha Técnica y Tabla 5 del Anexo Transaccional Simplificado (ATS)"
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
              icon="tags"
              title="No hay tipos de gasto registrados"
              description="Siembra el catálogo estándar del SRI con los 8 conceptos más utilizados en Ecuador (mercaderías, publicidad, servicios cloud, arriendos, honorarios)."
              action={
                canManage ? (
                  <Button variant="primary" onClick={() => void handleSeedDefaults()} disabled={seeding}>
                    <Sparkles size={16} />
                    {seeding ? 'Sembrando catálogo...' : 'Sembrar Catálogo Estándar SRI'}
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
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

export default ExpenseTypesListPage
