import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button, DataGrid, NumberBox, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import {
  Calculator,
  CheckCircle,
  HelpCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
} from 'lucide-react'
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
import { formatMoney } from '@/pages/catalog/pricing/pricingFormat'
import {
  createShippingRate,
  deleteShippingRate,
  listShippingRates,
  resolveShippingRates,
  updateShippingRate,
} from '@/services/shippingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
  CreateShippingRateRuleBody,
  ResolvedShippingOptionDto,
  ShippingRateRuleDto,
  UpdateShippingRateRuleBody,
} from '@/types/shippingApi'

type RuleRow = ShippingRateRuleDto & {
  totalFacturable?: number
  actions?: unknown
} & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('tarifa de envío', 'tarifas de envío')

const COMMON_ZONES = [
  { value: 'Local', label: 'Local (Ciudad / Cantón)' },
  { value: 'Provincia', label: 'Provincia (Nacional)' },
  { value: 'Galapagos', label: 'Galápagos (Región Insular)' },
  { value: 'Oriente', label: 'Oriente / Amazonía' },
  { value: '*', label: '* (Cualquier zona)' },
]

export function ShippingRatesMatrixPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('catalog.pricing.read') || useHasPermission('ecommerce.orders.read')
  const canCreate = useHasPermission('catalog.pricing.create') || useHasPermission('ecommerce.orders.manage')
  const canEdit = useHasPermission('catalog.pricing.update') || useHasPermission('ecommerce.orders.manage')
  const canDelete = useHasPermission('catalog.pricing.delete') || useHasPermission('ecommerce.orders.manage')

  const [rows, setRows] = useState<ShippingRateRuleDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active'>('active')

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ShippingRateRuleDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ShippingRateRuleDto | null>(null)

  // Form states
  const [formCarrier, setFormCarrier] = useState('')
  const [formZone, setFormZone] = useState('Local')
  const [formName, setFormName] = useState('')
  const [formMinQuantity, setFormMinQuantity] = useState(1)
  const [formMaxQuantity, setFormMaxQuantity] = useState<number | null>(null)
  const [formMinOrderAmount, setFormMinOrderAmount] = useState<number | null>(null)
  const [formPrice, setFormPrice] = useState(3.0)
  const [formTaxRate, setFormTaxRate] = useState(15.0)
  const [formEstimatedDays, setFormEstimatedDays] = useState('24-48 horas')
  const [formNotes, setFormNotes] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  // Simulador de cotización en vivo
  const [simZone, setSimZone] = useState('Provincia')
  const [simQty, setSimQty] = useState(36)
  const [simAmount, setSimAmount] = useState(150)
  const [simResults, setSimResults] = useState<ResolvedShippingOptionDto[]>([])
  const [simLoading, setSimLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listShippingRates(tenantId, {
        onlyActive: statusFilter === 'active',
      })
      setRows(data)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudieron cargar las tarifas de envío.'))
    } finally {
      setLoading(false)
    }
  }, [tenantId, statusFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Ejecutar simulación
  const runSimulation = useCallback(async () => {
    if (!tenantId) return
    setSimLoading(true)
    try {
      const results = await resolveShippingRates(tenantId, {
        zone: simZone.trim() || null,
        totalQuantity: simQty,
        totalOrderAmount: simAmount,
      })
      setSimResults(results)
    } catch {
      setSimResults([])
    } finally {
      setSimLoading(false)
    }
  }, [tenantId, simZone, simQty, simAmount])

  useEffect(() => {
    if (tenantId) {
      void runSimulation()
    }
  }, [runSimulation, tenantId])

  // Métricas de tarjetas
  const totalCount = rows.length
  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])
  const distinctCarriers = useMemo(() => new Set(rows.map((r) => r.carrier.trim().toLowerCase())).size, [rows])
  const distinctZones = useMemo(() => new Set(rows.map((r) => r.zone.trim().toLowerCase())).size, [rows])

  // Filtrado en memoria
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.carrier.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
    )
  }, [rows, search])

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } =
    useGluDataGridPaging(filteredRows.length)

  // Abrir modal creación
  const openCreateModal = () => {
    setEditingRule(null)
    setFormCarrier('')
    setFormZone('Local')
    setFormName('')
    setFormMinQuantity(1)
    setFormMaxQuantity(null)
    setFormMinOrderAmount(null)
    setFormPrice(3.0)
    setFormTaxRate(15.0)
    setFormEstimatedDays('24-48 horas')
    setFormNotes('')
    setFormSortOrder(0)
    setFormIsActive(true)
    setModalOpen(true)
  }

  // Abrir modal edición
  const openEditModal = (rule: ShippingRateRuleDto) => {
    setEditingRule(rule)
    setFormCarrier(rule.carrier)
    setFormZone(rule.zone)
    setFormName(rule.name)
    setFormMinQuantity(rule.minQuantity)
    setFormMaxQuantity(rule.maxQuantity)
    setFormMinOrderAmount(rule.minOrderAmount)
    setFormPrice(rule.price)
    setFormTaxRate(rule.taxRate)
    setFormEstimatedDays(rule.estimatedDays ?? '')
    setFormNotes(rule.notes ?? '')
    setFormSortOrder(rule.sortOrder)
    setFormIsActive(rule.isActive)
    setModalOpen(true)
  }

  // Guardar formulario
  const handleSave = async () => {
    if (!tenantId) return
    const carrier = formCarrier.trim()
    const zone = formZone.trim()
    const name = formName.trim()

    if (!carrier) {
      toast.show({ title: 'Validación', message: 'El transportista es obligatorio.', variant: 'warning' })
      return
    }
    if (!zone) {
      toast.show({ title: 'Validación', message: 'La zona de destino es obligatoria.', variant: 'warning' })
      return
    }
    if (!name) {
      toast.show({ title: 'Validación', message: 'El nombre de la tarifa es obligatorio.', variant: 'warning' })
      return
    }
    if (formPrice < 0) {
      toast.show({ title: 'Validación', message: 'El precio no puede ser negativo.', variant: 'warning' })
      return
    }
    if (formMinQuantity < 0) {
      toast.show({ title: 'Validación', message: 'La cantidad mínima no puede ser negativa.', variant: 'warning' })
      return
    }
    if (formMaxQuantity !== null && formMaxQuantity < formMinQuantity) {
      toast.show({
        title: 'Validación',
        message: 'La cantidad máxima no puede ser inferior a la mínima.',
        variant: 'warning',
      })
      return
    }

    setSaving(true)
    try {
      if (editingRule) {
        const body: UpdateShippingRateRuleBody = {
          carrier,
          zone,
          name,
          price: formPrice,
          minQuantity: formMinQuantity,
          maxQuantity: formMaxQuantity,
          minOrderAmount: formMinOrderAmount,
          taxRate: formTaxRate,
          estimatedDays: formEstimatedDays.trim() || null,
          notes: formNotes.trim() || null,
          sortOrder: formSortOrder,
          isActive: formIsActive,
        }
        await updateShippingRate(tenantId, editingRule.id, body)
        toast.show({ title: 'Tarifa actualizada', message: 'Regla de flete modificada exitosamente.', variant: 'success' })
      } else {
        const body: CreateShippingRateRuleBody = {
          carrier,
          zone,
          name,
          price: formPrice,
          minQuantity: formMinQuantity,
          maxQuantity: formMaxQuantity,
          minOrderAmount: formMinOrderAmount,
          taxRate: formTaxRate,
          estimatedDays: formEstimatedDays.trim() || null,
          notes: formNotes.trim() || null,
          sortOrder: formSortOrder,
        }
        await createShippingRate(tenantId, body)
        toast.show({ title: 'Tarifa creada', message: 'Regla de flete creada en la matriz.', variant: 'success' })
      }
      setModalOpen(false)
      void loadData()
      void runSimulation()
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo guardar la tarifa de envío.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // Eliminar regla
  const handleDelete = async () => {
    if (!tenantId || !confirmDelete) return
    try {
      await deleteShippingRate(tenantId, confirmDelete.id)
      toast.show({ title: 'Tarifa eliminada', message: 'La regla de flete ha sido eliminada.', variant: 'success' })
      setConfirmDelete(null)
      void loadData()
      void runSimulation()
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No se pudo eliminar la tarifa.'),
        variant: 'error',
      })
    }
  }

  // Definición de columnas
  const columns: ColumnDef<RuleRow>[] = useMemo(
    () => [
      {
        key: 'carrier',
        header: 'Transportista',
        width: 140,
        renderCell: (_val, row: RuleRow) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={15} style={{ color: 'var(--glb-primary, #0284c7)' }} aria-hidden />
            <span style={{ fontWeight: 600 }}>{row.carrier}</span>
          </div>
        ),
      },
      {
        key: 'zone',
        header: 'Zona',
        width: 110,
        renderCell: (_val, row: RuleRow) => (
          <span
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: 'var(--glb-surface-variant, #f1f5f9)',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {row.zone}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Nombre / Modalidad',
        width: 180,
        renderCell: (_val, row: RuleRow) => (
          <div>
            <div style={{ fontWeight: 500 }}>{row.name}</div>
            {row.notes ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
                {row.notes}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'minQuantity',
        header: 'Rango Cantidad',
        width: 130,
        renderCell: (_val, row: RuleRow) => (
          <span style={{ fontSize: '0.85rem' }}>
            {row.minQuantity > 1 ? `≥ ${row.minQuantity} u` : 'Desde 1 u'}
            {row.maxQuantity ? ` hasta ${row.maxQuantity} u` : ''}
          </span>
        ),
      },
      {
        key: 'price',
        header: 'Tarifa Base',
        width: 100,
        align: 'right',
        renderCell: (_val, row: RuleRow) => (
          <span style={{ fontWeight: 600 }}>{formatMoney(row.price)}</span>
        ),
      },
      {
        key: 'taxRate',
        header: 'IVA SRI',
        width: 90,
        align: 'right',
        renderCell: (_val, row: RuleRow) => (
          <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>
            {row.taxRate}%
          </span>
        ),
      },
      {
        key: 'totalFacturable',
        header: 'Total c/ IVA',
        width: 110,
        align: 'right',
        renderCell: (_val: unknown, row: RuleRow) => {
          const iva = Math.round(row.price * (row.taxRate / 100) * 100) / 100
          const total = row.price + iva
          return (
            <span style={{ fontWeight: 700, color: 'var(--glb-primary, #0284c7)' }}>
              {formatMoney(total)}
            </span>
          )
        },
      },
      {
        key: 'estimatedDays',
        header: 'Entrega',
        width: 110,
        renderCell: (_val, row: RuleRow) => (
          <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>
            {row.estimatedDays || '—'}
          </span>
        ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 90,
        align: 'center',
        renderCell: (_val, row: RuleRow) => (
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
        renderCell: (_val: unknown, row: RuleRow) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            {canEdit && (
              <GridIconButton
                label="Editar regla"
                icon={Pencil}
                onClick={() => openEditModal(row)}
              />
            )}
            {canDelete && (
              <GridIconButton
                label="Eliminar tarifa"
                icon={Trash2}
                danger
                onClick={() => setConfirmDelete(row)}
              />
            )}
          </div>
        ),
      },
    ],
    [canDelete, canEdit]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Tarifas de envío" lead="Configuración de envíos y fletes.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de catálogo o ecommerce para ver las tarifas de envío."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Matriz de Tarifas de Envío"
      lead="Tarifas de flete por zona geográfica, transportista y volumen para facturación electrónica y despacho."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Matriz de Tarifas de Envío"
          subtitle="Configuración de precios de flete por transportista, zona y volumen (ej: Cooperativa a partir de 3 docenas, Servientrega Nacional, Local). Los envíos se agregan a la facturación SRI como servicio gravado con IVA 15%."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                iconLeft={<Plus size={16} />}
                disabled={!canCreate}
                onClick={openCreateModal}
              >
                Nueva Tarifa
              </Button>
            </div>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de tarifas">
          <StatCard label="Total Reglas" value={totalCount} />
          <StatCard label="Reglas Activas" value={activeCount} />
          <StatCard label="Transportistas" value={distinctCarriers} />
          <StatCard label="Zonas Cubiertas" value={distinctZones} />
        </div>

        {/* Sección: Simulador interactivo en vivo */}
        <SectionCard
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calculator size={18} style={{ color: 'var(--glb-primary, #0284c7)' }} aria-hidden />
              <span>Simulador / Cotizador en Vivo de Tarifas</span>
            </div>
          }
          subtitle="Verifica cómo resuelve el motor de envíos según la zona y cantidad de artículos, detectando opciones por volumen y promociones aplicables."
        >
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div style={{ width: '180px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Zona de Destino:
              </label>
              <TextBox
                value={simZone}
                labelPosition="outlined"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSimZone(e.target.value)}
                placeholder="Ej: Provincia"
              />
            </div>
            <div style={{ width: '130px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Cant. Artículos:
              </label>
              <NumberBox
                value={simQty}
                min={1}
                step={1}
                labelPosition="outlined"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSimQty(Number(e.target.value) || 1)}
              />
            </div>
            <div style={{ width: '140px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Subtotal ($):
              </label>
              <NumberBox
                value={simAmount}
                min={0}
                step={10}
                labelPosition="outlined"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSimAmount(Number(e.target.value) || 0)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => void runSimulation()} disabled={simLoading}>
              <RefreshCw size={14} className={simLoading ? 'animate-spin' : ''} />
              Recalcular
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {simResults.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '1rem', color: 'var(--glb-muted, #64748b)', fontSize: '0.85rem' }}>
                No hay tarifas activas para la zona &quot;{simZone}&quot;. Agrega reglas en la tabla inferior para cotizar automáticamente.
              </div>
            ) : (
              simResults.map((opt) => (
                <div
                  key={opt.ruleId}
                  style={{
                    border: opt.isRecommended ? '2px solid #16a34a' : '1px solid var(--glb-border, #e2e8f0)',
                    backgroundColor: opt.isRecommended ? 'rgba(22, 163, 74, 0.04)' : 'var(--glb-surface, #ffffff)',
                    borderRadius: '8px',
                    padding: '0.875rem',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{opt.name}</div>
                    {opt.isRecommended ? (
                      <span
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <CheckCircle size={11} /> Recomendado
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)', marginBottom: '0.5rem' }}>
                    {opt.carrier} • {opt.zone} {opt.estimatedDays ? `• ${opt.estimatedDays}` : ''}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: opt.isEligible ? '#0f172a' : '#94a3b8' }}>
                        {formatMoney(opt.totalPrice)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)', marginLeft: '0.35rem' }}>
                        (Base {formatMoney(opt.basePrice)} + 15% IVA)
                      </span>
                    </div>
                  </div>

                  {!opt.isEligible && opt.unitsNeeded ? (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#d97706',
                        backgroundColor: '#fffbeb',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <HelpCircle size={13} />
                      <span>Faltan <strong>{opt.unitsNeeded} unidades</strong> para desbloquear esta tarifa por volumen.</span>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SectionCard>

        {/* Sección: Tabla de tarifas */}
        <SectionCard
          title="Reglas Configuradas en la Matriz"
          subtitle="Lista completa de tarifas de envío activas y reglas por volumen."
          action={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <TextBox
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Buscar transportista, zona..."
                labelPosition="outlined"
              />
              <Select
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as 'all' | 'active')}
                options={[
                  { value: 'active', label: 'Solo activas' },
                  { value: 'all', label: 'Todas las reglas' },
                ]}
              />
              <GridToolbarRefresh onRefresh={() => void loadData()} loading={loading} />
            </div>
          }
        >
          {error ? (
            <p className="welcome-onboarding__error" role="alert">
              {error}
            </p>
          ) : null}

          <DataGrid<RuleRow>
            className="ecu-companies-grid"
            dataSource={filteredRows as RuleRow[]}
            keyExpr="id"
            columns={columns}
            selectionMode="none"
            showSearch={false}
            paging={paging}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            paginationMode="client"
            pageSizeOptions={pageSizeOptions}
            layout="auto"
            loading={loading}
            emptyState={
              <EmptyState
                title="No hay tarifas de envío configuradas"
                description="Crea la primera regla para comenzar a cotizar y facturar envíos automáticamente."
              />
            }
            messages={gridMessages}
          />
        </SectionCard>

        {/* Modal Crear / Editar */}
        <Popup
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingRule ? 'Editar Tarifa de Envío' : 'Nueva Tarifa de Envío'}
          width="min(92vw, 36rem)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Transportista / Courier *
                </label>
                <TextBox
                  value={formCarrier}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormCarrier(e.target.value)}
                  placeholder="Ej: Servientrega, Cooperativa, Urbano"
                  labelPosition="outlined"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Zona de Destino *
                </label>
                <TextBox
                  value={formZone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormZone(e.target.value)}
                  placeholder="Ej: Local, Provincia, Galapagos, *"
                  labelPosition="outlined"
                />
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {COMMON_ZONES.map((z) => (
                    <button
                      key={z.value}
                      type="button"
                      onClick={() => setFormZone(z.value)}
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        cursor: 'pointer',
                      }}
                    >
                      {z.value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Nombre Visible / Descripción *
              </label>
              <TextBox
                value={formName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                placeholder="Ej: Cooperativa a partir de 36u, Servientrega Nacional"
                labelPosition="outlined"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Precio Base ($) *
                </label>
                <NumberBox
                  value={formPrice}
                  min={0}
                  step={0.5}
                  labelPosition="outlined"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormPrice(Number(e.target.value) || 0)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  IVA Facturación SRI (%)
                </label>
                <NumberBox
                  value={formTaxRate}
                  min={0}
                  max={100}
                  step={1}
                  labelPosition="outlined"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormTaxRate(Number(e.target.value) || 0)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Total con IVA
                </label>
                <div
                  style={{
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 700,
                    color: 'var(--glb-primary, #0284c7)',
                    fontSize: '1rem',
                  }}
                >
                  {formatMoney(formPrice + Math.round(formPrice * (formTaxRate / 100) * 100) / 100)}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Cantidad Mínima (Unidades) *
                </label>
                <NumberBox
                  value={formMinQuantity}
                  min={1}
                  step={1}
                  labelPosition="outlined"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormMinQuantity(Number(e.target.value) || 1)}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted, #64748b)' }}>
                  Ej: 36 para 3 docenas.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Cantidad Máxima (Opcional)
                </label>
                <NumberBox
                  value={formMaxQuantity ?? ''}
                  min={1}
                  step={1}
                  labelPosition="outlined"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value.trim()
                    setFormMaxQuantity(raw ? Number(raw) : null)
                  }}
                  placeholder="Sin límite superior"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Tiempo Estimado
                </label>
                <TextBox
                  value={formEstimatedDays}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormEstimatedDays(e.target.value)}
                  placeholder="Ej: 24h, 24-48 horas, Mismo día"
                  labelPosition="outlined"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Orden de Visualización
                </label>
                <NumberBox
                  value={formSortOrder}
                  step={1}
                  labelPosition="outlined"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormSortOrder(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Condiciones y Notas
              </label>
              <TextBox
                value={formNotes}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormNotes(e.target.value)}
                placeholder="Ej: Retiro en terminal terrestre de destino / bulto pesado"
                labelPosition="outlined"
              />
            </div>

            {editingRule && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Estado
                </label>
                <Select
                  value={formIsActive ? 'active' : 'inactive'}
                  onChange={(val) => setFormIsActive(val === 'active')}
                  options={[
                    { value: 'active', label: 'Activo' },
                    { value: 'inactive', label: 'Inactivo' },
                  ]}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando...' : editingRule ? 'Guardar Cambios' : 'Crear Tarifa'}
              </Button>
            </div>
          </div>
        </Popup>

        {/* Modal Confirmar Eliminación */}
        <Popup
          open={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          title="Confirmar Eliminación"
          width="min(92vw, 28rem)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <p>
              ¿Estás seguro de que deseas eliminar la regla de envío <strong>{confirmDelete?.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => void handleDelete()}>
                Eliminar
              </Button>
            </div>
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}
