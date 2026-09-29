import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, CheckButton, DataGrid, NumberBox, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import {
  Calculator,
  CheckCircle,
  HelpCircle,
  MapPin,
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
  listShippingMethods,
  listShippingRates,
  listShippingZones,
  resolveShippingRates,
  updateShippingRate,
} from '@/services/shippingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
  CreateShippingRateRuleBody,
  ResolvedShippingOptionDto,
  ShippingMethodDto,
  ShippingRateRuleDto,
  ShippingZoneDto,
  UpdateShippingRateRuleBody,
} from '@/types/shippingApi'

type RuleRow = ShippingRateRuleDto & { actions?: unknown } & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('tarifa de envío', 'tarifas de envío')

export function ShippingRatesMatrixPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const hasPricingRead = useHasPermission('catalog.pricing.read')
  const hasOrderRead = useHasPermission('ecommerce.orders.read')
  const canRead = hasPricingRead || hasOrderRead

  const hasPricingCreate = useHasPermission('catalog.pricing.create')
  const hasOrderManage = useHasPermission('ecommerce.orders.manage')
  const canManage = hasPricingCreate || hasOrderManage

  const [rows, setRows] = useState<ShippingRateRuleDto[]>([])
  const [zones, setZones] = useState<ShippingZoneDto[]>([])
  const [methods, setMethods] = useState<ShippingMethodDto[]>([])
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
  const [formZone, setFormZone] = useState('LOCAL')
  const [formName, setFormName] = useState('')
  const [formMinQuantity, setFormMinQuantity] = useState(1)
  const [formMaxQuantity, setFormMaxQuantity] = useState<number | null>(null)
  const [formMinOrderAmount, setFormMinOrderAmount] = useState<number | null>(null)
  const [formPrice, setFormPrice] = useState(3.0)
  const [formEstimatedDays, setFormEstimatedDays] = useState('24 a 48 horas')
  const [formNotes, setFormNotes] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  // Simulador de cotización en vivo
  const [simZone, setSimZone] = useState('PROVINCIA')
  const [simQty, setSimQty] = useState(36)
  const [simAmount, setSimAmount] = useState(150)
  const [simResults, setSimResults] = useState<ResolvedShippingOptionDto[]>([])
  const [simLoading, setSimLoading] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const [ratesData, zonesData, methodsData] = await Promise.all([
        listShippingRates(tenantId, { onlyActive: statusFilter === 'active' }),
        listShippingZones(tenantId, { onlyActive: true }).catch(() => [] as ShippingZoneDto[]),
        listShippingMethods(tenantId, { onlyActive: true }).catch(() => [] as ShippingMethodDto[]),
      ])
      setRows(ratesData)
      setZones(zonesData)
      setMethods(methodsData)

      if (zonesData.length > 0 && !simZone) {
        setSimZone(zonesData[0].name)
      }
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudieron cargar las tarifas de envío.'))
    } finally {
      setLoading(false)
    }
  }, [tenantId, statusFilter, simZone])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void runSimulation()
    }
  }, [runSimulation, tenantId])

  // Abrir modal de creación
  const openCreateModal = () => {
    setEditingRule(null)
    const firstCarrier = methods.length > 0 ? methods[0].name : 'Servientrega'
    const firstZone = zones.length > 0 ? zones[0].name : 'Local'
    setFormCarrier(firstCarrier)
    setFormZone(firstZone)
    setFormName(`${firstCarrier} - ${firstZone}`)
    setFormMinQuantity(1)
    setFormMaxQuantity(null)
    setFormMinOrderAmount(null)
    setFormPrice(5.0)
    setFormEstimatedDays('24 a 48 horas')
    setFormNotes('')
    setFormSortOrder(rows.length + 1)
    setFormIsActive(true)
    setModalOpen(true)
  }

  // Abrir modal de edición
  const openEditModal = (rule: ShippingRateRuleDto) => {
    setEditingRule(rule)
    setFormCarrier(rule.carrier)
    setFormZone(rule.zone)
    setFormName(rule.name)
    setFormMinQuantity(rule.minQuantity)
    setFormMaxQuantity(rule.maxQuantity)
    setFormMinOrderAmount(rule.minOrderAmount)
    setFormPrice(rule.price)
    setFormEstimatedDays(rule.estimatedDays ?? '')
    setFormNotes(rule.notes ?? '')
    setFormSortOrder(rule.sortOrder)
    setFormIsActive(rule.isActive)
    setModalOpen(true)
  }

  // Guardar regla
  const handleSave = async () => {
    if (!tenantId) return
    const carrier = formCarrier.trim()
    const zone = formZone.trim()
    const name = formName.trim()

    if (!carrier) {
      toast.show({ title: 'Validación', message: 'El transportista o courier es obligatorio.', variant: 'warning' })
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
      toast.show({ title: 'Validación', message: 'El precio del flete no puede ser negativo.', variant: 'warning' })
      return
    }
    if (formMinQuantity < 1) {
      toast.show({ title: 'Validación', message: 'La cantidad mínima debe ser al menos 1 unidad.', variant: 'warning' })
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
          taxRate: 0,
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
          taxRate: 0,
          estimatedDays: formEstimatedDays.trim() || null,
          notes: formNotes.trim() || null,
          sortOrder: formSortOrder,
        }
        await createShippingRate(tenantId, body)
        toast.show({ title: 'Tarifa creada', message: 'Regla de flete agregada a la matriz.', variant: 'success' })
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

  // Opciones dinámicas para selects de formulario y filtros
  const zoneOptions = useMemo(() => {
    const list = zones.map((z) => ({ value: z.name, label: `${z.name} (${z.code})` }))
    return [
      ...list,
      { value: '*', label: '* (Cualquier zona / Nacional)' },
    ]
  }, [zones])

  const carrierOptions = useMemo(() => {
    const list = methods.map((m) => ({ value: m.name, label: `${m.name} (${m.code})` }))
    return list
  }, [methods])

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

  // Métricas de tarjetas
  const totalCount = rows.length
  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])
  const distinctCarriers = useMemo(() => new Set(rows.map((r) => r.carrier.trim().toLowerCase())).size, [rows])
  const distinctZones = useMemo(() => new Set(rows.map((r) => r.zone.trim().toLowerCase())).size, [rows])

  // Columnas
  const columns: ColumnDef<RuleRow>[] = useMemo(
    () => [
      {
        key: 'carrier',
        header: 'Transportista / Courier',
        width: 170,
        renderCell: (_val, row: RuleRow) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={15} style={{ color: 'var(--glb-primary, #0284c7)' }} aria-hidden />
            <span style={{ fontWeight: 600 }}>{row.carrier}</span>
          </div>
        ),
      },
      {
        key: 'zone',
        header: 'Zona de Destino',
        width: 140,
        renderCell: (_val, row: RuleRow) => (
          <span
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: 'var(--glb-surface-variant, rgba(125, 125, 125, 0.12))',
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
        header: 'Modalidad / Descripción',
        renderCell: (_val, row: RuleRow) => (
          <div>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
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
        header: 'Rango Unidades',
        width: 140,
        renderCell: (_val, row: RuleRow) => (
          <span style={{ fontSize: '0.85rem' }}>
            {row.minQuantity > 1 ? `≥ ${row.minQuantity} u` : 'Desde 1 u'}
            {row.maxQuantity ? ` hasta ${row.maxQuantity} u` : ''}
          </span>
        ),
      },
      {
        key: 'price',
        header: 'Tarifa Flete ($)',
        width: 120,
        align: 'right',
        renderCell: (_val, row: RuleRow) => (
          <span style={{ fontWeight: 700, color: 'var(--glb-primary, #0284c7)', fontSize: '0.95rem' }}>
            {formatMoney(row.price)}
          </span>
        ),
      },
      {
        key: 'estimatedDays',
        header: 'Entrega',
        width: 130,
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
            {canManage && (
              <GridIconButton
                label="Editar regla"
                icon={Pencil}
                onClick={() => openEditModal(row)}
              />
            )}
            {canManage && (
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
    [canManage]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Tarifas de Envío" lead="Matriz de tarifas y reglas de flete para despachos.">
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
    <TenantSessionGate title="Tarifas de Envío" lead="Matriz de tarifas y reglas de flete para despachos.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Tarifas de Envío"
          subtitle="Configura los precios de transporte por courier, zona y volumen. Las tarifas representan el valor base del flete; los impuestos SRI se aplican al facturar."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                iconLeft={<Truck size={16} />}
                onClick={() => navigate('/ecommerce/envios/metodos')}
              >
                Métodos de envío
              </Button>
              <Button
                variant="outline"
                iconLeft={<MapPin size={16} />}
                onClick={() => navigate('/ecommerce/envios/zonas')}
              >
                Zonas de destino
              </Button>
              {canManage ? (
                <Button variant="primary" iconLeft={<Plus size={16} />} onClick={openCreateModal}>
                  + Nueva Tarifa
                </Button>
              ) : null}
            </div>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de fletes">
          <StatCard label="Reglas configuradas" value={totalCount} />
          <StatCard label="Reglas activas" value={activeCount} />
          <StatCard label="Couriers con tarifa" value={distinctCarriers} />
          <StatCard label="Zonas cubiertas" value={distinctZones} />
        </div>

        {/* Sección: Simulador de cotización en vivo */}
        <SectionCard
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calculator size={18} style={{ color: 'var(--glb-primary, #0284c7)' }} />
              <span>Simulador / Cotizador en Vivo de Flete</span>
            </div>
          }
          subtitle="Verifica cómo resuelve el motor de envíos según la zona y cantidad de artículos, detectando opciones por volumen."
        >
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div style={{ minWidth: 200 }}>
              <TextBox
                id="sim-zone"
                label="Zona de Destino"
                labelPosition="outlined"
                variant="outline"
                value={simZone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSimZone(e.target.value)}
                placeholder="Ej: Local, Provincia..."
              />
            </div>
            <div style={{ width: 140 }}>
              <NumberBox
                id="sim-qty"
                label="Cant. Artículos"
                labelPosition="outlined"
                variant="outline"
                value={simQty}
                min={1}
                step={1}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSimQty(Number(e.target.value) || 1)}
              />
            </div>
            <div style={{ width: 150 }}>
              <NumberBox
                id="sim-amount"
                label="Subtotal Pedido ($)"
                labelPosition="outlined"
                variant="outline"
                value={simAmount}
                min={0}
                step={10}
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
                    backgroundColor: opt.isRecommended ? 'rgba(22, 163, 74, 0.05)' : 'var(--glb-surface, #ffffff)',
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
                        {formatMoney(opt.basePrice)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)', marginLeft: '0.35rem' }}>
                        (Tarifa flete)
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
            toolbarLeft={
              <div style={{ minWidth: 260, maxWidth: 360, width: '100%' }}>
                <TextBox
                  id="sr-search"
                  label="Buscar tarifa"
                  labelPosition="outlined"
                  variant="outline"
                  value={search}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  placeholder="Buscar transportista, zona o nombre…"
                  fullWidth
                />
              </div>
            }
            toolbarRight={
              <div className="ecu-grid-toolbar-actions" style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 150 }}>
                  <Select
                    id="sr-status-filter"
                    label="Estado"
                    labelPosition="outlined"
                    variant="outline"
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val as 'all' | 'active')}
                    options={[
                      { value: 'active', label: 'Solo activas' },
                      { value: 'all', label: 'Todas las reglas' },
                    ]}
                  />
                </div>
                <GridToolbarRefresh onRefresh={() => void loadData()} loading={loading} />
                {canManage ? (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={openCreateModal}>
                    + Nueva Tarifa
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
                title="No hay tarifas de envío configuradas"
                description="Crea la primera regla para comenzar a cotizar y facturar envíos automáticamente."
                action={
                  canManage ? (
                    <Button variant="primary" onClick={openCreateModal}>
                      + Crear Tarifa de Envío
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
          title={editingRule ? 'Editar Tarifa de Envío' : 'Nueva Tarifa de Envío'}
          width="min(92vw, 36rem)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.75rem 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                {carrierOptions.length > 0 ? (
                  <Select
                    id="sr-carrier-select"
                    label="Transportista / Courier *"
                    labelPosition="outlined"
                    variant="outline"
                    value={formCarrier}
                    onChange={(val) => {
                      setFormCarrier(String(val))
                      if (!editingRule) {
                        setFormName(`${String(val)} - ${formZone}`)
                      }
                    }}
                    options={carrierOptions}
                    fullWidth
                  />
                ) : (
                  <TextBox
                    id="sr-carrier"
                    label="Transportista / Courier *"
                    labelPosition="outlined"
                    variant="outline"
                    value={formCarrier}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormCarrier(e.target.value)}
                    placeholder="Servientrega, Cooperativa…"
                    fullWidth
                  />
                )}
              </div>

              <div>
                {zoneOptions.length > 0 ? (
                  <Select
                    id="sr-zone-select"
                    label="Zona de Destino *"
                    labelPosition="outlined"
                    variant="outline"
                    value={formZone}
                    onChange={(val) => {
                      setFormZone(String(val))
                      if (!editingRule) {
                        setFormName(`${formCarrier} - ${String(val)}`)
                      }
                    }}
                    options={zoneOptions}
                    fullWidth
                  />
                ) : (
                  <TextBox
                    id="sr-zone"
                    label="Zona de Destino *"
                    labelPosition="outlined"
                    variant="outline"
                    value={formZone}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormZone(e.target.value)}
                    placeholder="Local, Provincia, *"
                    fullWidth
                  />
                )}
              </div>
            </div>

            <div>
              <TextBox
                id="sr-name"
                label="Nombre Visible / Modalidad *"
                labelPosition="outlined"
                variant="outline"
                value={formName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                placeholder="Ej: Cooperativa a partir de 36u, Servientrega Nacional"
                fullWidth
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <NumberBox
                  id="sr-price"
                  label="Tarifa de Envío ($) *"
                  labelPosition="outlined"
                  variant="outline"
                  value={formPrice}
                  min={0}
                  step={0.5}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormPrice(Number(e.target.value) || 0)}
                  fullWidth
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.2rem', display: 'block' }}>
                  Valor del flete antes de impuestos. El IVA SRI se aplica al emitir la factura.
                </span>
              </div>

              <div>
                <TextBox
                  id="sr-days"
                  label="Tiempo Estimado de Entrega"
                  labelPosition="outlined"
                  variant="outline"
                  value={formEstimatedDays}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormEstimatedDays(e.target.value)}
                  placeholder="Ej: 24h, 24 a 48 horas"
                  fullWidth
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <NumberBox
                  id="sr-min-qty"
                  label="Cantidad Mínima (Unidades) *"
                  labelPosition="outlined"
                  variant="outline"
                  value={formMinQuantity}
                  min={1}
                  step={1}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormMinQuantity(Number(e.target.value) || 1)}
                  fullWidth
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted, #64748b)' }}>
                  Ej: 36 para calificar a partir de 3 docenas.
                </span>
              </div>

              <div>
                <NumberBox
                  id="sr-max-qty"
                  label="Cantidad Máxima (Opcional)"
                  labelPosition="outlined"
                  variant="outline"
                  value={formMaxQuantity ?? ''}
                  min={1}
                  step={1}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value.trim()
                    setFormMaxQuantity(raw ? Number(raw) : null)
                  }}
                  placeholder="Sin límite superior"
                  fullWidth
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <NumberBox
                  id="sr-sort"
                  label="Orden de visualización"
                  labelPosition="outlined"
                  variant="outline"
                  value={formSortOrder}
                  step={1}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormSortOrder(Number(e.target.value) || 0)}
                  fullWidth
                />
              </div>

              {editingRule ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <CheckButton
                    id="sr-active"
                    variant="ghost"
                    checked={formIsActive}
                    onChange={(checked: boolean) => setFormIsActive(checked)}
                  >
                    {formIsActive ? 'Tarifa activa' : 'Tarifa inactiva'}
                  </CheckButton>
                </div>
              ) : null}
            </div>

            <div>
              <TextBox
                id="sr-notes"
                label="Notas y Condiciones Adicionales"
                labelPosition="outlined"
                variant="outline"
                value={formNotes}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormNotes(e.target.value)}
                placeholder="Ej: Entrega en terminal terrestre, retiro en agencia, etc."
                fullWidth
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando...' : editingRule ? 'Actualizar Tarifa' : 'Crear Tarifa'}
              </Button>
            </div>
          </div>
        </Popup>

        {/* Modal Confirmar Eliminación */}
        <Popup
          open={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          title="Eliminar Tarifa de Envío"
          width="min(92vw, 28rem)"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              ¿Estás seguro de que deseas eliminar la tarifa <strong>{confirmDelete?.name}</strong>?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.5rem' }}>
              Esta acción no se puede deshacer. Los cotizadores dejarán de sugerir esta opción.
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
