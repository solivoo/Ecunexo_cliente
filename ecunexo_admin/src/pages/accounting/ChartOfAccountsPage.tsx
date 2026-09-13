import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  CheckButton,
  DataGrid,
  Select,
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
import {
  CornerDownRight,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createAccount,
  deleteAccount,
  listAccounts,
  seedStandardPlan,
  updateAccount,
} from '@/services/accountingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { AccountModal } from '@/pages/accounting/AccountModal'
import type {
  AccountDto,
  CreateAccountPayload,
  UpdateAccountPayload,
} from '@/types/accountingApi'
import { ACCOUNT_TYPES } from '@/types/accountingApi'

type AccountRow = AccountDto & Record<string, unknown>

export function ChartOfAccountsPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('contabilidad.plan.contable.read') ||
    useHasPermission('contabilidad.cuentas.read') ||
    useHasPermission('contabilidad.read')
  const canManage =
    useHasPermission('contabilidad.plan.contable.manage') ||
    useHasPermission('contabilidad.cuentas.manage')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<AccountDto[]>([])

  // Filtros
  const [selectedType, setSelectedType] = useState<string>('all')
  const [allowsMovementOnly, setAllowsMovementOnly] = useState(false)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountDto | null>(null)
  const [parentAccountForNew, setParentAccountForNew] = useState<AccountDto | null>(null)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await listAccounts(tenantId, {
        type: selectedType === 'all' ? undefined : Number(selectedType),
        allowsMovementOnly: allowsMovementOnly ? true : undefined,
      })
      setAccounts(data)
    } catch (err: unknown) {
      toast.show({
        title: 'Error de carga',
        message: readApiError(err, 'No se pudo cargar el plan de cuentas contables.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, selectedType, allowsMovementOnly, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSeed = async () => {
    if (!tenantId) return
    setSaving(true)
    try {
      const count = await seedStandardPlan(tenantId)
      toast.show({
        title: 'Plan Oficial Sembrado',
        message:
          count > 0
            ? `Se inicializaron ${count} cuentas según catálogo oficial SCVS Ecuador.`
            : 'El plan de cuentas ya contiene las cuentas oficiales estándar.',
        variant: 'success',
      })
      await loadData()
    } catch (err: unknown) {
      toast.show({
        title: 'Error de inicialización',
        message: readApiError(err, 'No se pudo sembrar el catálogo estándar.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = useCallback((parent?: AccountDto) => {
    setEditingAccount(null)
    setParentAccountForNew(parent || null)
    setModalOpen(true)
  }, [])

  const handleEdit = useCallback((account: AccountDto) => {
    setEditingAccount(account)
    setParentAccountForNew(null)
    setModalOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (account: AccountDto) => {
      if (account.isSystem) {
        toast.show({
          title: 'Acción no permitida',
          message: 'Las cuentas base oficiales del sistema no pueden eliminarse.',
          variant: 'warning',
        })
        return
      }

      if (!window.confirm(`¿Confirma que desea eliminar la cuenta ${account.code} — ${account.name}?`)) {
        return
      }

      if (!tenantId) return
      try {
        await deleteAccount(tenantId, account.id)
        toast.show({
          title: 'Cuenta eliminada',
          message: `La cuenta ${account.code} fue retirada.`,
          variant: 'success',
        })
        await loadData()
      } catch (err: unknown) {
        toast.show({
          title: 'Error al eliminar',
          message: readApiError(err, 'No se pudo eliminar la cuenta contable.'),
          variant: 'error',
        })
      }
    },
    [tenantId, loadData, toast]
  )

  const handleSave = async (payload: CreateAccountPayload | UpdateAccountPayload) => {
    if (!tenantId) return
    setSaving(true)
    try {
      if (editingAccount) {
        await updateAccount(tenantId, editingAccount.id, payload as UpdateAccountPayload)
        toast.show({
          title: 'Cuenta actualizada',
          message: `La cuenta ${editingAccount.code} se actualizó correctamente.`,
          variant: 'success',
        })
      } else {
        await createAccount(tenantId, payload as CreateAccountPayload)
        toast.show({
          title: 'Cuenta creada',
          message: 'La cuenta contable se registró en el catálogo.',
          variant: 'success',
        })
      }
      setModalOpen(false)
      await loadData()
    } catch (err: unknown) {
      throw new Error(readApiError(err, 'Error al guardar la cuenta.'))
    } finally {
      setSaving(false)
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    const total = accounts.length
    const activos = accounts.filter((a) => a.typeId === 1).length
    const pasivos = accounts.filter((a) => a.typeId === 2).length
    const gastos = accounts.filter((a) => a.typeId === 5).length
    const imputables = accounts.filter((a) => a.allowsMovement).length
    return { total, activos, pasivos, gastos, imputables }
  }, [accounts])

  // Columnas DataGrid
  const columns = useMemo((): ColumnDef<AccountRow>[] => {
    return [
      {
        key: 'code',
        header: 'Código',
        width: 190,
        sortable: true,
        renderCell: (_value, row: AccountRow) => {
          const indent = Math.max(0, (row.level - 1) * 14)
          const isGroup = !row.allowsMovement
          return (
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: `${indent}px` }}>
              {row.level > 1 && (
                <CornerDownRight
                  size={12}
                  style={{ marginRight: '6px', opacity: 0.45, flexShrink: 0 }}
                />
              )}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: isGroup ? '0.875rem' : '0.8125rem',
                  fontWeight: isGroup ? 700 : 500,
                  color: isGroup ? 'var(--shell-primary, #6366f1)' : 'var(--glb-text, #f1f5f9)',
                }}
              >
                {row.code}
              </span>
            </div>
          )
        },
      },
      {
        key: 'name',
        header: 'Denominación / Cuenta',
        width: 320,
        sortable: true,
        renderCell: (_value, row: AccountRow) => {
          const isGroup = !row.allowsMovement
          return (
            <div>
              <div
                style={{
                  fontWeight: isGroup ? 700 : 500,
                  fontSize: '0.875rem',
                  color: isGroup ? 'var(--glb-text)' : 'inherit',
                }}
              >
                {row.name}
              </div>
              {row.description && (
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', marginTop: '2px' }}>
                  {row.description}
                </div>
              )}
            </div>
          )
        },
      },
      {
        key: 'type',
        header: 'Clasificación NIIF',
        width: 160,
        sortable: true,
        renderCell: (_value, row: AccountRow) => {
          const config = ACCOUNT_TYPES.find((t) => t.id === row.typeId)
          let tone: 'info' | 'warning' | 'neutral' | 'success' | 'danger' = 'neutral'
          if (row.typeId === 1) tone = 'info'
          else if (row.typeId === 2) tone = 'warning'
          else if (row.typeId === 3) tone = 'neutral'
          else if (row.typeId === 4) tone = 'success'
          else if (row.typeId === 5) tone = 'danger'

          return <StatusBadge tone={tone}>{config?.label || row.type}</StatusBadge>
        },
      },
      {
        key: 'nature',
        header: 'Naturaleza',
        width: 140,
        sortable: true,
        renderCell: (_value, row: AccountRow) => {
          const isDebit = row.natureId === 1
          return (
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: isDebit ? 'var(--glb-info, #38bdf8)' : 'var(--glb-warning, #fbbf24)',
              }}
            >
              {isDebit ? 'Deudora (Debe)' : 'Acreedora (Haber)'}
            </span>
          )
        },
      },
      {
        key: 'allowsMovement',
        header: 'Imputable',
        width: 130,
        sortable: true,
        renderCell: (_value, row: AccountRow) =>
          row.allowsMovement ? (
            <StatusBadge tone="success">Movimiento</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Mayor / Título</StatusBadge>
          ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 100,
        sortable: true,
        renderCell: (_value, row: AccountRow) => (
          <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
            {row.isActive ? 'Activa' : 'Inactiva'}
          </StatusBadge>
        ),
      },
      {
        key: 'id',
        header: 'Acciones',
        width: 120,
        sortable: false,
        renderCell: (_value, row: AccountRow) => {
          if (!canManage) return null
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {!row.allowsMovement && (
                <GridIconButton
                  label="Agregar subcuenta derivada"
                  icon={Plus}
                  onClick={() => handleCreate(row)}
                />
              )}
              <GridIconButton
                label="Editar cuenta"
                icon={Pencil}
                onClick={() => handleEdit(row)}
              />
              {!row.isSystem && (
                <GridIconButton
                  label="Eliminar cuenta personalizada"
                  icon={Trash2}
                  danger
                  onClick={() => void handleDelete(row)}
                />
              )}
            </div>
          )
        },
      },
    ]
  }, [canManage, handleCreate, handleEdit, handleDelete])

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging(
    accounts.length
  )

  const messages = useMemo(() => createSpanishDataGridMessages('cuenta', 'cuentas'), [])

  if (!canRead) {
    return (
      <TenantSessionGate
        title="Plan de Cuentas"
        lead="Plan General de Cuentas NIIF / SCVS Ecuador."
      >
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de contabilidad para ver el plan de cuentas."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Plan General de Cuentas"
      lead="Catálogo oficial NIIF SCVS para imputación de compras, ventas, retenciones SRI, bancos y kárdex contable."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Plan General de Cuentas"
          subtitle="Estructura oficial NIIF / SCVS Ecuador para asientos de compras, proveedores, facturación y activos."
          badge={
            <StatusBadge tone="primary" withDot>
              NIIF / SCVS Ecuador
            </StatusBadge>
          }
          actions={
            canManage ? (
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <Button
                  variant="outline"
                  onClick={() => void handleSeed()}
                  disabled={saving}
                >
                  <Sparkles size={16} />
                  Sembrar Oficial SCVS
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleCreate()}
                  disabled={saving}
                >
                  <Plus size={16} />
                  Nueva Cuenta
                </Button>
              </div>
            ) : undefined
          }
        />

        {/* Strip de métricas M3 wrap en ecu-stat-grid obligatorio */}
        <div className="ecu-stat-grid" aria-label="Resumen del plan de cuentas">
          <StatCard
            label="Total Cuentas"
            value={String(kpis.total)}
            footerText="Cuentas registradas"
            icon="menu_book"
            toneColor="#6366f1"
          />
          <StatCard
            label="1. Activos"
            value={String(kpis.activos)}
            footerText="Bancos, inventario, crédito SRI"
            icon="account_balance_wallet"
            toneColor="#0ea5e9"
          />
          <StatCard
            label="2. Pasivos"
            value={String(kpis.pasivos)}
            footerText="Proveedores, retenciones SRI"
            icon="payment"
            toneColor="#f59e0b"
          />
          <StatCard
            label="5. Costos y Gastos"
            value={String(kpis.gastos)}
            footerText="Costos y gastos operacionales"
            icon="receipt_long"
            toneColor="#ef4444"
          />
          <StatCard
            label="Imputables"
            value={String(kpis.imputables)}
            footerText="Cuentas con movimiento directo"
            icon="account_tree"
            toneColor="#10b981"
          />
        </div>

        <SectionCard
          title="Árbol y Catálogo de Cuentas"
          subtitle="Estructura jerárquica conforme al marco normativo de la Superintendencia de Compañías, Valores y Seguros del Ecuador."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'ecu-spin' : ''} />
              Refrescar
            </Button>
          }
        >
          {/* Toolbar de filtros secundarios */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.875rem',
              alignItems: 'center',
              marginBottom: '1rem',
              padding: '0.75rem',
              borderRadius: '8px',
              backgroundColor: 'var(--glb-surface-2, rgba(255,255,255,0.02))',
              border: '1px solid var(--shell-border, rgba(255,255,255,0.08))',
            }}
          >
            <div style={{ width: '250px' }}>
              <Select
                value={selectedType}
                onChange={(val) => setSelectedType(val || 'all')}
                options={[
                  { value: 'all', label: '— Todos los Grupos NIIF —' },
                  ...ACCOUNT_TYPES.map((t) => ({ value: String(t.id), label: t.label })),
                ]}
              />
            </div>

            <div>
              <CheckButton
                checked={allowsMovementOnly}
                onChange={(checked: boolean) => setAllowsMovementOnly(checked)}
              >
                Solo Cuentas Imputables (de Movimiento)
              </CheckButton>
            </div>
          </div>

          {/* Grid o Empty State */}
          {!loading && accounts.length === 0 ? (
            <EmptyState
              icon="menu_book"
              title="Plan de cuentas sin inicializar"
              description="No se han registrado cuentas contables en esta empresa. Puede sembrar automáticamente la estructura oficial recomendada por la SCVS para Ecuador."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => void handleSeed()}
                    disabled={saving}
                  >
                    <Sparkles size={16} />
                    Sembrar Catálogo Estándar SCVS Ecuador
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              dataSource={accounts as AccountRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={320}
              searchPlaceholder="Filtrar por código o denominación..."
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>

        {modalOpen && (
          <AccountModal
            open={modalOpen}
            account={editingAccount}
            parentAccount={parentAccountForNew}
            saving={saving}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
          />
        )}
      </div>
    </TenantSessionGate>
  )
}
