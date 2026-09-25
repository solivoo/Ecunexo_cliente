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
  GridToolbarRefresh,
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
              <code
                className="ecu-code"
                style={{
                  fontSize: isGroup ? '0.875rem' : '0.8125rem',
                  fontWeight: isGroup ? 700 : 500,
                }}
              >
                {row.code}
              </code>
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
                  color: isGroup ? 'var(--idt-ink)' : 'inherit',
                }}
              >
                {row.name}
              </div>
              {row.description && (
                <span
                  className="ecu-hint ecu-clip ecu-clip--wide"
                  title={row.description}
                >
                  {row.description}
                </span>
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
          return <span className="ecu-chip">{config?.label || row.type}</span>
        },
      },
      {
        key: 'nature',
        header: 'Naturaleza',
        width: 140,
        sortable: true,
        renderCell: (_value, row: AccountRow) => {
          const isDebit = row.natureId === 1
          return isDebit ? (
            <span className="ecu-chip">Deudora (Debe)</span>
          ) : (
            <span className="ecu-chip ecu-chip--muted">Acreedora (Haber)</span>
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
            <span className="ecu-chip">Movimiento</span>
          ) : (
            <span className="ecu-chip ecu-chip--muted">Mayor / Título</span>
          ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 100,
        sortable: true,
        renderCell: (_value, row: AccountRow) => (
          <span
            className={`ecu-status ${row.isActive ? 'ecu-status--active' : 'ecu-status--inactive'}`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {row.isActive ? 'Activa' : 'Inactiva'}
          </span>
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
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de contabilidad para ver el plan de cuentas."
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
      <div className="ecu-dashboard-layout ecu-section-page ecu-dashboard-layout--fluid">
        <PageHeader
          title="Plan General de Cuentas"
          subtitle="Catálogo de cuentas NIIF para la operación contable."
          badge={<StatusBadge tone="neutral">NIIF / SCVS Ecuador</StatusBadge>}
        />

        <div className="ecu-stat-grid" aria-label="Resumen del plan de cuentas">
          <StatCard label="Total cuentas" value={kpis.total} />
          <StatCard label="1. Activos" value={kpis.activos} />
          <StatCard label="2. Pasivos" value={kpis.pasivos} />
          <StatCard label="Imputables" value={kpis.imputables} />
        </div>

        <SectionCard title="Árbol y Catálogo de Cuentas">
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
            <>
              <div className="ecu-commandbar">
                <div className="ecu-commandbar__filter">
                  <Select
                    value={selectedType}
                    onChange={(val) => setSelectedType(val || 'all')}
                    options={[
                      { value: 'all', label: '— Todos los Grupos NIIF —' },
                      ...ACCOUNT_TYPES.map((t) => ({ value: String(t.id), label: t.label })),
                    ]}
                    fullWidth
                  />
                </div>
                <div className="ecu-commandbar__action">
                  <CheckButton
                    checked={allowsMovementOnly}
                    onChange={(checked: boolean) => setAllowsMovementOnly(checked)}
                  >
                    Solo imputables
                  </CheckButton>
                </div>
                <div className="ecu-commandbar__spacer" />
                <div className="ecu-commandbar__action">
                  <div className="ecu-grid-toolbar-actions">
                    <GridToolbarRefresh
                      loading={loading}
                      onRefresh={() => void loadData()}
                    />
                    {canManage ? (
                      <>
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
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

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
            </>
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
