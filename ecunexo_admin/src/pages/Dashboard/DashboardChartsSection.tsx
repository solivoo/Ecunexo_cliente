import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useHasPermission } from '@/hooks/useHasPermission'
import { SectionCard, StatusBadge } from '@/components/ui'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  getDashboardAnalytics,
  type DashboardAnalyticsResponseDto,
} from '@/services/dashboardApi'
import { toIsoDate, type IsoDateRange } from '@/lib/gridLookback'
import { listInvoices } from '@/services/billingApi'
import type { InvoiceListItem } from '@/types/billingApi'
import { ensureBillingEmitter, loadIssuerDefaults } from '@/pages/facturacion/invoiceEmitApi'
import { roundMoney } from '@/pages/facturacion/invoiceFormTypes'

// --- ESTRUCTURAS INICIALES SIN DATOS SINTÉTICOS (BASE CERO HASTA CARGAR BD) ---

const DEFAULT_SALES_TREND = [
  { mes: 'Ene', ventas: 0, comprobantes: 0 },
  { mes: 'Feb', ventas: 0, comprobantes: 0 },
  { mes: 'Mar', ventas: 0, comprobantes: 0 },
  { mes: 'Abr', ventas: 0, comprobantes: 0 },
  { mes: 'May', ventas: 0, comprobantes: 0 },
  { mes: 'Jun', ventas: 0, comprobantes: 0 },
]

const DEFAULT_SRI_STATUS = [
  { name: 'Autorizadas', value: 0, color: '#10b981' },
  { name: 'Borradores', value: 0, color: '#6366f1' },
  { name: 'Devueltas', value: 0, color: '#f59e0b' },
]

const DEFAULT_CUSTOMER_TYPES = [
  { tipo: 'Corporativo B2B', cantidad: 0 },
  { tipo: 'Persona Natural', cantidad: 0 },
  { tipo: 'Mayoristas', cantidad: 0 },
  { tipo: 'Consumidor Final', cantidad: 0 },
]

const DEFAULT_PURCHASES_EXPENSES = [
  { mes: 'Ene', inventario: 0, servicios: 0 },
  { mes: 'Feb', inventario: 0, servicios: 0 },
  { mes: 'Mar', inventario: 0, servicios: 0 },
  { mes: 'Abr', inventario: 0, servicios: 0 },
  { mes: 'May', inventario: 0, servicios: 0 },
  { mes: 'Jun', inventario: 0, servicios: 0 },
]

const DEFAULT_INVENTORY_WAREHOUSE = [
  { bodega: 'Matriz Principal', stockFisico: 0, stockMinimo: 0 },
  { bodega: 'Sucursal Norte', stockFisico: 0, stockMinimo: 0 },
  { bodega: 'Bodega Cumbayá', stockFisico: 0, stockMinimo: 0 },
  { bodega: 'Taller Guayaquil', stockFisico: 0, stockMinimo: 0 },
]

const DEFAULT_REMISION_GUIDES = [
  { name: 'Autorizadas', value: 0, color: '#10b981' },
  { name: 'En Tránsito', value: 0, color: '#0284c7' },
  { name: 'Entregadas', value: 0, color: '#6366f1' },
]

const DEFAULT_REPAIR_STAGES = [
  { name: 'Diagnóstico', value: 0, color: '#8b5cf6' },
  { name: 'Reparación', value: 0, color: '#eab308' },
  { name: 'QC / Despacho', value: 0, color: '#10b981' },
]

const DEFAULT_FINANCIAL_BALANCE = [
  { rubro: 'Activos', monto: 0 },
  { rubro: 'Pasivos', monto: 0 },
  { rubro: 'Patrimonio', monto: 0 },
]

const DEFAULT_TAX_DECLARATIONS = [
  { mes: 'Ene', ivacobrado: 0, ivasoportado: 0, retenciones: 0 },
  { mes: 'Feb', ivacobrado: 0, ivasoportado: 0, retenciones: 0 },
  { mes: 'Mar', ivacobrado: 0, ivasoportado: 0, retenciones: 0 },
  { mes: 'Abr', ivacobrado: 0, ivasoportado: 0, retenciones: 0 },
  { mes: 'May', ivacobrado: 0, ivasoportado: 0, retenciones: 0 },
  { mes: 'Jun', ivacobrado: 0, ivasoportado: 0, retenciones: 0 },
]

// Formateador compacto de números para ejes Y (1k, 10k, 1M, etc.)
function formatCompactNumber(value: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  return String(value)
}

// Tooltip Personalizado con Estética M3 / Dark Mode
function CustomTooltip({ active, payload, label, isCurrency = false }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="ecu-chart-tooltip">
        <p className="ecu-chart-tooltip__label">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="ecu-chart-tooltip__item">
            <span className="ecu-chart-tooltip__dot" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="ecu-chart-tooltip__name">{entry.name}:</span>
            <strong className="ecu-chart-tooltip__value">
              {isCurrency
                ? `$${Number(entry.value).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : Number(entry.value).toLocaleString('es-EC')}
            </strong>
          </div>
        ))}
      </div>
    )
  }
  return null
}

function getPresetDateRange(preset: 'semanal' | 'mensual' | 'anual'): IsoDateRange {
  const now = new Date()
  const today = toIsoDate(now)
  if (preset === 'semanal') {
    const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    return { from: toIsoDate(fromDate), to: today }
  }
  if (preset === 'mensual') {
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    return { from: toIsoDate(fromDate), to: today }
  }
  const fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  return { from: toIsoDate(fromDate), to: today }
}

function computeSalesTrend(
  invoices: InvoiceListItem[],
  mode: 'semanal' | 'mensual' | 'anual' | 'custom',
  fromIso: string
): { mes: string; ventas: number; comprobantes: number }[] {
  const activeInvoices = invoices.filter((i) => i.state === 'Authorized' && !i.isVoided)

  if (mode === 'semanal') {
    const points: { mes: string; dateStr: string; ventas: number; comprobantes: number }[] = []
    const start = new Date(fromIso)
    for (let i = 0; i <= 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const dateStr = toIsoDate(d)
      const dayName = new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric' }).format(d)
      points.push({ mes: dayName, dateStr, ventas: 0, comprobantes: 0 })
    }

    for (const inv of activeInvoices) {
      const invDate = inv.issueDate.slice(0, 10)
      const pt = points.find((p) => p.dateStr === invDate)
      if (pt) {
        pt.ventas += inv.grandTotal ?? 0
        pt.comprobantes += 1
      }
    }

    return points.map(({ mes, ventas, comprobantes }) => ({
      mes,
      ventas: roundMoney(ventas),
      comprobantes,
    }))
  }

  if (mode === 'mensual') {
    const points: { mes: string; fromDay: string; toDay: string; ventas: number; comprobantes: number }[] = []
    const start = new Date(fromIso)
    for (let i = 0; i < 4; i++) {
      const wStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 7)
      const wEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (i + 1) * 7 - 1)
      const label = `Sem ${i + 1} (${wStart.getDate()}/${wStart.getMonth() + 1})`
      points.push({
        mes: label,
        fromDay: toIsoDate(wStart),
        toDay: toIsoDate(wEnd),
        ventas: 0,
        comprobantes: 0,
      })
    }

    for (const inv of activeInvoices) {
      const invDate = inv.issueDate.slice(0, 10)
      const pt = points.find((p) => invDate >= p.fromDay && invDate <= p.toDay)
      if (pt) {
        pt.ventas += inv.grandTotal ?? 0
        pt.comprobantes += 1
      }
    }

    return points.map(({ mes, ventas, comprobantes }) => ({
      mes,
      ventas: roundMoney(ventas),
      comprobantes,
    }))
  }

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const now = new Date()
  const points: { mes: string; yearMonth: string; ventas: number; comprobantes: number }[] = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = monthNames[d.getMonth()]
    points.push({ mes: label, yearMonth: ym, ventas: 0, comprobantes: 0 })
  }

  for (const inv of activeInvoices) {
    const ym = inv.issueDate.slice(0, 7)
    const pt = points.find((p) => p.yearMonth === ym)
    if (pt) {
      pt.ventas += inv.grandTotal ?? 0
      pt.comprobantes += 1
    }
  }

  return points.map(({ mes, ventas, comprobantes }) => ({
    mes,
    ventas: roundMoney(ventas),
    comprobantes,
  }))
}

export type DashboardChartsSectionProps = {
  readonly isHolderOnly?: boolean
}

export function DashboardChartsSection({ isHolderOnly = false }: DashboardChartsSectionProps) {
  const activeTenantId = useAppSelector(selectTenantId)
  const [analyticsData, setAnalyticsData] = useState<DashboardAnalyticsResponseDto | null>(null)
  const [salesPeriodPreset] = useState<'semanal' | 'mensual' | 'anual'>('semanal')
  const [salesDateRange] = useState<IsoDateRange>(() => getPresetDateRange('semanal'))
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])

  useEffect(() => {
    if (!activeTenantId) return
    let cancelled = false

    void (async () => {
      try {
        const res = await getDashboardAnalytics(activeTenantId)
        if (!cancelled) {
          setAnalyticsData(res)
        }
      } catch {
        // Mantiene datos estables de reserva
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeTenantId])

  // Permisos RBAC / ABAC para visibilidad granular
  const canBilling = useHasPermission('facturacion.facturas.read') || useHasPermission('billing.invoices.read')
  const canPurchases = useHasPermission('purchases.documents.read') || useHasPermission('purchases.suppliers.read')
  const canInventory = useHasPermission('inventory.stock.read') || useHasPermission('warehousing.warehouses.read')
  const canRepairs = useHasPermission('repairs.equipment.read') || useHasPermission('repairs.batches.read')
  const canAccounting = useHasPermission('contabilidad.balances.read') || useHasPermission('contabilidad.asientos.read')
  const canRemision = useHasPermission('facturacion.guias.remision.read') || canBilling
  const canTax = useHasPermission('contabilidad.declaraciones.read') || canAccounting

  useEffect(() => {
    if (!activeTenantId || !canBilling) return
    let cancelled = false
    void (async () => {
      try {
        const defaults = await loadIssuerDefaults(activeTenantId)
        const emitterId = await ensureBillingEmitter({
          emitterRuc: defaults.emitterRuc,
          company: defaults.company,
          companyLabel: defaults.company.legalName || '',
          tenantId: activeTenantId,
        })
        const list = await listInvoices(emitterId, {
          page: 1,
          pageSize: 500,
          from: salesDateRange.from,
          to: salesDateRange.to,
        })
        if (!cancelled) {
          setInvoices([...list.items])
        }
      } catch {
        if (!cancelled) setInvoices([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTenantId, canBilling, salesDateRange.from, salesDateRange.to])

  const computedSalesTrend = useMemo(() => {
    if (invoices.length > 0) {
      return computeSalesTrend(invoices, salesPeriodPreset, salesDateRange.from)
    }
    return analyticsData?.salesMonthlyTrend ?? DEFAULT_SALES_TREND
  }, [invoices, salesPeriodPreset, salesDateRange.from, analyticsData])

  const totalPeriodSales = useMemo(() => {
    if (invoices.length > 0) {
      return invoices
        .filter((i) => i.state === 'Authorized' && !i.isVoided)
        .reduce((s, i) => s + (i.grandTotal ?? 0), 0)
    }
    return computedSalesTrend.reduce((s, d) => s + d.ventas, 0)
  }, [invoices, computedSalesTrend])

  const hasAnyPermission = useMemo(() => {
    return (
      canBilling ||
      canPurchases ||
      canInventory ||
      canRepairs ||
      canAccounting ||
      canRemision ||
      canTax ||
      isHolderOnly
    )
  }, [canBilling, canPurchases, canInventory, canRepairs, canAccounting, canRemision, canTax, isHolderOnly])

  const sriStatus = analyticsData?.sriStatusDistribution ?? DEFAULT_SRI_STATUS
  const customerTypes = analyticsData?.customerTypeDistribution ?? DEFAULT_CUSTOMER_TYPES
  const purchasesExpenses = analyticsData?.purchasesExpensesTrend ?? DEFAULT_PURCHASES_EXPENSES
  const warehouseStock = analyticsData?.warehouseStockDistribution ?? DEFAULT_INVENTORY_WAREHOUSE
  const remisionGuides = analyticsData?.remisionGuidesStatus ?? DEFAULT_REMISION_GUIDES
  const repairStages = analyticsData?.repairStagesDistribution ?? DEFAULT_REPAIR_STAGES
  const financialBalance = analyticsData?.financialBalance ?? DEFAULT_FINANCIAL_BALANCE
  const taxDeclarations = analyticsData?.taxDeclarationsTrend ?? DEFAULT_TAX_DECLARATIONS


  // Etiquetas cortas para el gráfico de directorio de clientes
  const formattedCustomerTypes = useMemo(() => {
    return customerTypes.map((c) => ({
      ...c,
      shortLabel:
        c.tipo === 'Corporativo B2B'
          ? 'Corp. B2B'
          : c.tipo === 'Persona Natural'
            ? 'Natural'
            : c.tipo === 'Mayoristas'
              ? 'Mayorista'
              : c.tipo === 'Consumidor Final'
                ? 'Consumidor'
                : c.tipo,
    }))
  }, [customerTypes])

  // Nombres recortados para bodegas en el gráfico horizontal
  const formattedWarehouseStock = useMemo(() => {
    return warehouseStock.map((w) => ({
      ...w,
      shortName: w.bodega.length > 12 ? `${w.bodega.slice(0, 10)}..` : w.bodega,
    }))
  }, [warehouseStock])

  if (!hasAnyPermission) {
    return null
  }

  return (
    <div className="ecu-dashboard-charts-container">
      <div className="ecu-dashboard-charts-header">
        <div>
          <h2 className="ecu-dashboard-charts-title">Indicadores de Gestión y Operación en Tiempo Real</h2>
          <p className="ecu-dashboard-charts-subtitle">
            Analítica visual sincronizada con la base de datos PostgreSQL según los permisos asignados a tu rol.
          </p>
        </div>
      </div>

      <div className="ecu-dashboard-charts-grid">
        {/* GRÁFICO 1: Facturación y Ventas Mensuales */}
        {canBilling && (
          <SectionCard
            title="Facturación y Ventas"
            subtitle="Evolución de ventas ($ USD)"
            action={<StatusBadge tone="success">SRI Facturas</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <div className="ecu-chart-header-kpi">
                <span className="ecu-chart-kpi-val">
                  ${totalPeriodSales.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="ecu-chart-kpi-sub">
                  Total acumulado en el período
                </span>
              </div>
              <ResponsiveContainer width="100%" height={175}>
                <AreaChart data={computedSalesTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="mes" stroke="var(--glb-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--glb-muted)" fontSize={10} tickLine={false} tickFormatter={formatCompactNumber} width={32} />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    name="Monto Facturado"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorVentas)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {/* GRÁFICO 2: Estado Tributario SRI */}
        {canBilling && (
          <SectionCard
            title="Comprobantes SRI"
            subtitle="Desglose por estado"
            action={<StatusBadge tone="primary">SRI Ecuador</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <ResponsiveContainer width="100%" height={175}>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={sriStatus}
                    cx="50%"
                    cy="40%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sriStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#4f46e5'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={24}
                    iconSize={8}
                    formatter={(value) => <span style={{ color: 'var(--glb-text)', fontSize: '0.72rem' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {/* GRÁFICO 3: Clientes por Tipo de Categoría */}
        {canBilling && (
          <SectionCard
            title="Directorio de Clientes"
            subtitle="Segmentación por tipo"
            action={<StatusBadge tone="info">Clientes</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <ResponsiveContainer width="100%" height={175}>
                <BarChart data={formattedCustomerTypes} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="shortLabel" stroke="var(--glb-muted)" fontSize={9} tickLine={false} interval={0} />
                  <YAxis stroke="var(--glb-muted)" fontSize={10} tickLine={false} tickFormatter={formatCompactNumber} width={28} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cantidad" name="Clientes Activos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {/* GRÁFICO 4: Compras vs Gastos Operativos */}
        {canPurchases && (
          <SectionCard
            title="Compras y Servicios"
            subtitle="Inventario vs Gastos ($ USD)"
            action={<StatusBadge tone="info">Compras SRI</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <ResponsiveContainer width="100%" height={175}>
                <BarChart data={purchasesExpenses} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="mes" stroke="var(--glb-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--glb-muted)" fontSize={10} tickLine={false} tickFormatter={formatCompactNumber} width={32} />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Legend verticalAlign="bottom" height={24} iconSize={8} formatter={(value) => <span style={{ color: 'var(--glb-text)', fontSize: '0.72rem' }}>{value}</span>} />
                  <Bar dataKey="inventario" name="Mercadería" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="servicios" name="Gastos" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {/* GRÁFICO 5: Disponibilidad por Bodega */}
        {canInventory && (
          <SectionCard
            title="Stock por Bodega"
            subtitle="Físico vs Nivel Mínimo"
            action={<StatusBadge tone="warning">Bodegas</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <ResponsiveContainer width="100%" height={175}>
                <BarChart
                  layout="vertical"
                  data={formattedWarehouseStock}
                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis type="number" stroke="var(--glb-muted)" fontSize={9} tickLine={false} tickFormatter={formatCompactNumber} />
                  <YAxis dataKey="shortName" type="category" stroke="var(--glb-muted)" fontSize={9} tickLine={false} width={75} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={24} iconSize={8} formatter={(value) => <span style={{ color: 'var(--glb-text)', fontSize: '0.72rem' }}>{value}</span>} />
                  <Bar dataKey="stockFisico" name="Físico" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="stockMinimo" name="Mínimo" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {/* GRÁFICO 6: Guías de Remisión SRI */}
        {canRemision && (
          <SectionCard
            title="Guías de Remisión"
            subtitle="Estado de traslado (Tipo 06)"
            action={<StatusBadge tone="primary">Logística SRI</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <ResponsiveContainer width="100%" height={175}>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={remisionGuides}
                    cx="50%"
                    cy="40%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {remisionGuides.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#0284c7'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={24}
                    iconSize={8}
                    formatter={(value) => <span style={{ color: 'var(--glb-text)', fontSize: '0.72rem' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {/* GRÁFICO 7: Taller de Reparaciones */}
        {canRepairs && (
          <SectionCard
            title="Taller de Reparaciones"
            subtitle="Pipeline técnico de equipos"
            action={<StatusBadge tone="neutral">Taller N1/N2</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <ResponsiveContainer width="100%" height={175}>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={repairStages}
                    cx="50%"
                    cy="40%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {repairStages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#8b5cf6'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={24}
                    iconSize={8}
                    formatter={(value) => <span style={{ color: 'var(--glb-text)', fontSize: '0.72rem' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {/* GRÁFICO 8: Estructura Financiera NIIF */}
        {canAccounting && (
          <SectionCard
            title="Balance Financiero NIIF"
            subtitle="Activos vs Pasivos vs Patrimonio"
            action={<StatusBadge tone="primary">NIIF PYMES</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <ResponsiveContainer width="100%" height={175}>
                <BarChart data={financialBalance} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="rubro" stroke="var(--glb-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--glb-muted)" fontSize={10} tickLine={false} tickFormatter={formatCompactNumber} width={32} />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Bar dataKey="monto" name="Valor ($)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}

        {/* GRÁFICO 9: Pre-declaración Tributaria F104/F103 */}
        {canTax && (
          <SectionCard
            title="Declaraciones SRI F104"
            subtitle="IVA Ventas vs IVA Compras"
            action={<StatusBadge tone="success">Tributario</StatusBadge>}
          >
            <div className="ecu-chart-wrapper">
              <ResponsiveContainer width="100%" height={175}>
                <BarChart data={taxDeclarations} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="mes" stroke="var(--glb-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--glb-muted)" fontSize={10} tickLine={false} tickFormatter={formatCompactNumber} width={32} />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Legend verticalAlign="bottom" height={24} iconSize={8} formatter={(value) => <span style={{ color: 'var(--glb-text)', fontSize: '0.72rem' }}>{value}</span>} />
                  <Bar dataKey="ivacobrado" name="IVA Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ivasoportado" name="IVA Compras" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
