import { useCallback, useEffect, useState } from 'react'
import { Button, Select } from 'glubox'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileText,
  Receipt,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { useAppToast } from '@/components/toast/useAppToast'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { readApiError } from '@/lib/readApiError'
import { getMonthlyTaxDeclaration } from '@/services/taxDeclarationsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { MonthlyTaxDeclarationResponse } from '@/types/taxDeclarationsApi'

const MONTHS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [
  { value: String(CURRENT_YEAR), label: String(CURRENT_YEAR) },
  { value: String(CURRENT_YEAR - 1), label: String(CURRENT_YEAR - 1) },
]

export default function TaxDeclarationsPage() {
  const tenantId = useAppSelector(selectTenantId)
  const toast = useAppToast()

  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'f104' | 'f103' | 'conciliacion'>('f104')
  const [data, setData] = useState<MonthlyTaxDeclarationResponse | null>(null)

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const res = await getMonthlyTaxDeclaration(tenantId, Number(year), Number(month))
      setData(res)
    } catch (err) {
      toast.error(
        'Error al calcular pre-declaración',
        readApiError(err, 'No se pudo liquidar los impuestos del período solicitado.')
      )
    } finally {
      setLoading(false)
    }
  }, [tenantId, year, month, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val)

  return (
    <TenantSessionGate
      title="Declaraciones Tributarias"
      lead="Cálculo preventivo y conciliación fiscal para declaraciones de IVA y Retenciones SRI."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Pre-Declaración Tributaria y Cierre Fiscal"
          subtitle="Liquidación preventiva de IVA mensual (F104), Retenciones en la Fuente (F103) y cruce contable para empresas S.A.S."
          badge={
            <StatusBadge tone="primary" withDot>
              SRI F104 & F103
            </StatusBadge>
          }
          actions={
            <div className="flex items-center gap-3">
              <div className="w-36">
                <Select
                  value={month}
                  onChange={(val) => setMonth(String(val))}
                  options={MONTHS}
                />
              </div>
              <div className="w-28">
                <Select
                  value={year}
                  onChange={(val) => setYear(String(val))}
                  options={YEARS}
                />
              </div>
              <Button
                variant="outline"
                onClick={fetchData}
                disabled={loading}
                title="Recalcular período"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          }
        />

        {/* KPIs Strip en ecu-stat-grid según Regla 2 */}
        {data && (
          <div className="ecu-stat-grid mb-6">
            <StatCard
              label="IVA Cobrado en Ventas"
              value={formatCurrency(data.formulario104.ventas.casillero411IvaGenerado)}
              icon={<TrendingUp size={20} />}
              toneColor="#0284c7"
              footerText="Casillero 411 SRI"
            />
            <StatCard
              label="IVA Compras Soportado"
              value={formatCurrency(data.formulario104.compras.casillero569CreditoTributarioAplicable)}
              icon={<TrendingDown size={20} />}
              toneColor="#059669"
              footerText="Casillero 569 Crédito Fiscal"
            />
            <StatCard
              label="Retenciones en Fuente IR"
              value={formatCurrency(data.formulario103.totalRetenidoAPagar)}
              icon={<Receipt size={20} />}
              toneColor="#d97706"
              footerText="F103 Retenciones a Pagar"
            />
            <StatCard
              label={
                data.formulario104.liquidacion.generaImpuestoAPagar
                  ? 'Saldo IVA a Pagar'
                  : 'Crédito Fiscal Próximo Mes'
              }
              value={
                data.formulario104.liquidacion.generaImpuestoAPagar
                  ? formatCurrency(data.formulario104.liquidacion.saldoNetoAPagar)
                  : formatCurrency(data.formulario104.liquidacion.casillero615CreditoTributarioMesSiguiente)
              }
              icon={<Scale size={20} />}
              toneColor={
                data.formulario104.liquidacion.generaImpuestoAPagar ? '#dc2626' : '#10b981'
              }
              footerText={
                data.formulario104.liquidacion.generaImpuestoAPagar
                  ? 'A favor del fisco (SRI)'
                  : 'A favor de la empresa'
              }
            />
          </div>
        )}

        {/* Navegación por pestañas de declaración */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('f104')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'f104'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Formulario 104 (IVA Mensual)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('f103')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'f103'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Formulario 103 (Retenciones en la Fuente)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('conciliacion')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'conciliacion'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Conciliación S.A.S. & Contadora
          </button>
        </div>

        {/* Contenido según pestaña */}
        {loading || !data ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
            Calculando liquidación tributaria para {MONTHS.find((m) => m.value === month)?.label} {year}...
          </div>
        ) : activeTab === 'f104' ? (
          <div className="space-y-6">
            {/* Sección Ventas F104 */}
            <SectionCard title="1. Resumen de Ventas e Ingresos (F104 - Casilleros 400)">
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Concepto SRI</th>
                      <th className="py-3 px-4 text-center">Casillero</th>
                      <th className="py-3 px-4 text-right">Base Imponible ($)</th>
                      <th className="py-3 px-4 text-center">Casillero Imp.</th>
                      <th className="py-3 px-4 text-right">Impuesto Generado ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-3 px-4 font-medium">
                        Ventas locales gravadas tarifa diferente de 0% (15%)
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-indigo-600">
                        401
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatCurrency(data.formulario104.ventas.casillero401BaseGravada)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-indigo-600">
                        411
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatCurrency(data.formulario104.ventas.casillero411IvaGenerado)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium">
                        Ventas locales tarifa 0% que no dan derecho a crédito tributario
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-indigo-600">
                        403
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatCurrency(data.formulario104.ventas.casillero403BaseTarifaCero)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400">—</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">$0.00</td>
                    </tr>
                    <tr className="bg-slate-50/70 dark:bg-slate-800/40 font-semibold">
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-100">
                        TOTAL VENTAS Y OTRAS OPERACIONES
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-indigo-600">429</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(data.formulario104.ventas.casillero429TotalVentas)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-indigo-600">499</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(data.formulario104.ventas.casillero499TotalImpuestoGenerado)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* Sección Compras F104 */}
            <SectionCard title="2. Resumen de Adquisiciones y Crédito Tributario (F104 - Casilleros 500)">
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Concepto SRI</th>
                      <th className="py-3 px-4 text-center">Casillero</th>
                      <th className="py-3 px-4 text-right">Base Imponible ($)</th>
                      <th className="py-3 px-4 text-center">Casillero Imp.</th>
                      <th className="py-3 px-4 text-right">Impuesto Soportado ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-3 px-4 font-medium">
                        Adquisiciones y pagos gravados tarifa diferente de 0% (con derecho a crédito)
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-600">
                        500
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatCurrency(data.formulario104.compras.casillero500BaseGravada)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-600">
                        510
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatCurrency(data.formulario104.compras.casillero510IvaPagado)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium">
                        Adquisiciones y pagos gravados tarifa 0%
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-600">
                        507
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatCurrency(data.formulario104.compras.casillero507BaseTarifaCero)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400">—</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">$0.00</td>
                    </tr>
                    <tr className="bg-slate-50/70 dark:bg-slate-800/40 font-semibold">
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-100">
                        TOTAL ADQUISICIONES Y PAGOS
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-600">529</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(data.formulario104.compras.casillero529TotalAdquisiciones)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-600">569</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(data.formulario104.compras.casillero569CreditoTributarioAplicable)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between text-xs text-slate-500">
                <span>
                  Factor de Proporcionalidad del Crédito Tributario (Casillero 564):{' '}
                  <strong className="text-slate-800 dark:text-slate-200 font-mono text-sm">
                    {data.formulario104.compras.casillero564FactorProporcionalidad.toFixed(4)}
                  </strong>
                </span>
                <span>
                  Crédito Tributario Efectivo del Período:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                    {formatCurrency(data.formulario104.compras.casillero569CreditoTributarioAplicable)}
                  </strong>
                </span>
              </div>
            </SectionCard>

            {/* Liquidación F104 */}
            <SectionCard title="3. Liquidación del Impuesto al Valor Agregado (F104 - Casilleros 600)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Impuesto Causado (Casillero 601):
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(data.formulario104.liquidacion.casillero601ImpuestoCausado)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Retenciones de IVA recibidas (Casillero 609):
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(data.formulario104.liquidacion.casillero609RetencionesIvaRecibidas)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Crédito Tributario para mes siguiente (Casillero 615):
                    </span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(data.formulario104.liquidacion.casillero615CreditoTributarioMesSiguiente)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col justify-center items-end border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    {data.formulario104.liquidacion.generaImpuestoAPagar
                      ? 'Total a Pagar al SRI (Casillero 699)'
                      : 'Saldo Favorable para Próximo Mes'}
                  </span>
                  <span
                    className={`text-3xl font-mono font-bold ${
                      data.formulario104.liquidacion.generaImpuestoAPagar
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {data.formulario104.liquidacion.generaImpuestoAPagar
                      ? formatCurrency(data.formulario104.liquidacion.saldoNetoAPagar)
                      : formatCurrency(data.formulario104.liquidacion.casillero615CreditoTributarioMesSiguiente)}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {data.formulario104.liquidacion.generaImpuestoAPagar
                      ? 'Pagar antes del día 28 según noveno dígito del RUC'
                      : 'Crédito fiscal deducible en la siguiente declaración'}
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : activeTab === 'f103' ? (
          <SectionCard title="Formulario 103 — Retenciones en la Fuente de Impuesto a la Renta">
            {data.formulario103.lineas.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Receipt className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="font-medium">No se aplicaron retenciones en la fuente en este período.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Código SRI</th>
                      <th className="py-3 px-4">Concepto de Retención</th>
                      <th className="py-3 px-4 text-center">% Ret.</th>
                      <th className="py-3 px-4 text-right">Base Imponible ($)</th>
                      <th className="py-3 px-4 text-right">Monto Retenido ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.formulario103.lineas.map((line) => (
                      <tr key={line.codigoRetencion}>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                          {line.codigoRetencion}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {line.descripcion}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {line.porcentaje}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {formatCurrency(line.baseImponible)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(line.montoRetenido)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 font-semibold">
                      <td colSpan={3} className="py-3 px-4 text-slate-800 dark:text-slate-100">
                        TOTAL RETENCIONES EN LA FUENTE A PAGAR (F103)
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(data.formulario103.totalBaseImponible)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400 text-base">
                        {formatCurrency(data.formulario103.totalRetenidoAPagar)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : (
          /* Conciliación S.A.S. */
          <div className="space-y-6">
            <SectionCard title="Ajuste de Cuentas Integral para la Contadora & Directorio S.A.S.">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">
                    Ventas Netas Período
                  </span>
                  <span className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.conciliacion.totalVentasNetas)}
                  </span>
                  <span className="text-xs text-slate-400 block mt-1">Facturación operacional</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">
                    Compras y Gastos Netos
                  </span>
                  <span className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.conciliacion.totalComprasNetas)}
                  </span>
                  <span className="text-xs text-slate-400 block mt-1">
                    {data.conciliacion.totalFacturasCompra} facturas + {data.conciliacion.totalLiquidacionesCompra} liquidaciones
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">
                    Margen Bruto Operativo
                  </span>
                  <span
                    className={`text-xl font-mono font-bold ${
                      data.conciliacion.margenBrutoOperativo >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(data.conciliacion.margenBrutoOperativo)}
                  </span>
                  <span className="text-xs text-slate-400 block mt-1">Ventas - Costos/Gastos</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">
                    Compromiso Tributario Total
                  </span>
                  <span className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.conciliacion.flujoTributarioNetoEstimado)}
                  </span>
                  <span className="text-xs text-slate-400 block mt-1">IVA neto + Retenciones IR</span>
                </div>
              </div>

              {/* Banner de Auditoría NIIF */}
              <div
                className={`p-5 rounded-xl border flex items-center gap-4 ${
                  data.conciliacion.todoCuadradoNIIF
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                }`}
              >
                {data.conciliacion.todoCuadradoNIIF ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-amber-600 flex-shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {data.conciliacion.todoCuadradoNIIF
                      ? 'Libro Diario 100% Cuadrado y Conciliado bajo NIIF'
                      : 'Atención: Existen Asientos Descuadrados o Pendientes de Contabilizar'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {data.conciliacion.todoCuadradoNIIF
                      ? `Se verificaron ${data.conciliacion.totalAsientosContabilizados} asientos contables en el período ${data.periodName}. La sumatoria de débitos iguala a los créditos con precisión absoluta.`
                      : 'Revise los asientos en estado borrador en el Libro Diario antes de presentar la declaración al SRI.'}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </TenantSessionGate>
  )
}
