import { useCallback, useEffect, useState } from 'react'
import { Button, Select } from 'glubox'
import {
  AlertCircle,
  CheckCircle2,
  PieChart,
  Printer,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { useAppToast } from '@/components/toast/useAppToast'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { readApiError } from '@/lib/readApiError'
import { getFinancialStatements } from '@/services/financialStatementsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { FinancialStatementsResponse } from '@/types/financialStatementsApi'

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

export default function FinancialStatementsPage() {
  const tenantId = useAppSelector(selectTenantId)
  const toast = useAppToast()

  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'balance' | 'resultados'>('balance')
  const [data, setData] = useState<FinancialStatementsResponse | null>(null)

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const res = await getFinancialStatements(tenantId, Number(year), Number(month))
      setData(res)
    } catch (err) {
      toast.error(
        'Error al obtener estados financieros',
        readApiError(err, 'No se pudo generar el balance y estado de resultados.')
      )
    } finally {
      setLoading(false)
    }
  }, [tenantId, year, month, toast])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const formatCurrency = (val: number | undefined | null) => {
    const num = val ?? 0
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num)
  }

  const formatAmount = (val: number | undefined | null) => {
    const num = val ?? 0
    return new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <TenantSessionGate
      title="Estados Financieros Oficiales S.A.S."
      lead="Balance General y Estado de Resultados Integral conforme a NIIF para PYMES y SuperCompañías Ecuador."
    >
      <div className="ecu-dashboard-layout ecu-section-page ecu-dashboard-layout--fluid">
        <PageHeader
          title="Estados Financieros NIIF & Balances S.A.S."
          subtitle="Balance general y estado de resultados por período."
          badge={<StatusBadge tone="neutral">NIIF PYMES / SCVS Ecuador</StatusBadge>}
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
              <Button
                variant="outline"
                onClick={handlePrint}
                title="Imprimir o guardar PDF"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir / PDF
              </Button>
            </div>
          }
        />

        {data && (
          <div className="ecu-stat-grid" aria-label="Resumen de estados financieros">
            <StatCard
              label="Total Activos (Inversión)"
              value={formatCurrency(data.balanceGeneral.totalActivos)}
            />
            <StatCard
              label="Total Pasivos (Obligaciones)"
              value={formatCurrency(data.balanceGeneral.totalPasivos)}
            />
            <StatCard
              label="Patrimonio Neto"
              value={formatCurrency(data.balanceGeneral.totalPatrimonioNeto)}
            />
            <StatCard
              label="Utilidad neta (USD)"
              value={formatAmount(data.estadoResultados.utilidadNetaEjercicio)}
            />
          </div>
        )}

        {/* Pestañas de Navegación */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('balance')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'balance'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Scale className="w-4 h-4" />
            Estado de Situación Financiera (Balance General)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resultados')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'resultados'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Estado de Resultados Integral (P&G)
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
            <p>Calculando estados financieros consolidados bajo NIIF...</p>
          </div>
        ) : !data ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron movimientos contables para el período seleccionado.
          </div>
        ) : activeTab === 'balance' ? (
          /* PESTAÑA: BALANCE GENERAL */
          <div className="space-y-6">
            {/* Verificación de Ecuación Contable */}
            <div
              className={`p-4 rounded-xl border flex items-center gap-3 ${
                data.balanceGeneral.estaEquilibrado
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
              }`}
            >
              {data.balanceGeneral.estaEquilibrado ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {data.balanceGeneral.estaEquilibrado
                    ? 'Ecuación Fundamental NIIF Cuadrada (Activo = Pasivo + Patrimonio)'
                    : 'Atención: Descuadre Contable Temporal'}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {data.balanceGeneral.estaEquilibrado
                    ? `Total Activo (${formatCurrency(data.balanceGeneral.totalActivos)}) coincide con Total Pasivo + Patrimonio (${formatCurrency(data.balanceGeneral.totalPasivoYPatrimonio)}). Diferencia: ${formatCurrency(data.balanceGeneral.diferenciaCuadre)}.`
                    : `Diferencia de auditoría: ${formatCurrency(data.balanceGeneral.diferenciaCuadre)}. Revise los asientos manuales pendientes en el Libro Diario.`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lado Izquierdo: 1. ACTIVOS */}
              <div className="space-y-6">
                <SectionCard title="1. ACTIVOS" bodyClassName="ecu-section-card__body--padded">
                  {/* Activo Corriente */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center py-2 px-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                      <span>1.1 Activo Corriente</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(data.balanceGeneral.totalActivoCorriente)}
                      </span>
                    </div>

                    <div className="space-y-2 pl-2">
                      {data.balanceGeneral.activoCorriente.map((grp) => (
                        <div
                          key={grp.groupCode}
                          className="flex justify-between items-center py-1.5 px-3 text-sm border-b border-slate-100 dark:border-slate-800/50"
                        >
                          <span className="text-slate-700 dark:text-slate-300">
                            <strong className="font-mono text-xs text-slate-400 mr-2">
                              {grp.groupCode}
                            </strong>
                            {grp.groupName}
                          </span>
                          <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrency(grp.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activo No Corriente */}
                  {data.balanceGeneral.totalActivoNoCorriente > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center py-2 px-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                        <span>1.2 Activo No Corriente</span>
                        <span className="font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(data.balanceGeneral.totalActivoNoCorriente)}
                        </span>
                      </div>

                      <div className="space-y-2 pl-2">
                        {data.balanceGeneral.activoNoCorriente.map((grp) => (
                          <div
                            key={grp.groupCode}
                            className="flex justify-between items-center py-1.5 px-3 text-sm border-b border-slate-100 dark:border-slate-800/50"
                          >
                            <span className="text-slate-700 dark:text-slate-300">
                              <strong className="font-mono text-xs text-slate-400 mr-2">
                                {grp.groupCode}
                              </strong>
                              {grp.groupName}
                            </span>
                            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency(grp.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total Activos */}
                  <div className="flex justify-between items-center p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg font-bold text-sm text-indigo-900 dark:text-indigo-200 mt-4 border border-indigo-100 dark:border-indigo-900/50">
                    <span>TOTAL ACTIVOS</span>
                    <span className="font-mono text-base">
                      {formatCurrency(data.balanceGeneral.totalActivos)}
                    </span>
                  </div>
                </SectionCard>
              </div>

              {/* Lado Derecho: 2. PASIVOS Y 3. PATRIMONIO */}
              <div className="space-y-6">
                {/* 2. PASIVOS */}
                <SectionCard title="2. PASIVOS" bodyClassName="ecu-section-card__body--padded">
                  <div className="mb-4">
                    <div className="flex justify-between items-center py-2 px-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                      <span>2.1 Pasivo Corriente</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(data.balanceGeneral.totalPasivoCorriente)}
                      </span>
                    </div>

                    <div className="space-y-2 pl-2">
                      {data.balanceGeneral.pasivoCorriente.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-1 px-3">
                          Sin pasivos pendientes en el período.
                        </p>
                      ) : (
                        data.balanceGeneral.pasivoCorriente.map((grp) => (
                          <div
                            key={grp.groupCode}
                            className="flex justify-between items-center py-1.5 px-3 text-sm border-b border-slate-100 dark:border-slate-800/50"
                          >
                            <span className="text-slate-700 dark:text-slate-300">
                              <strong className="font-mono text-xs text-slate-400 mr-2">
                                {grp.groupCode}
                              </strong>
                              {grp.groupName}
                            </span>
                            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency(grp.total)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Total Pasivos */}
                  <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg font-bold text-sm text-amber-900 dark:text-amber-200 mt-2 border border-amber-100 dark:border-amber-900/50">
                    <span>TOTAL PASIVOS</span>
                    <span className="font-mono text-base">
                      {formatCurrency(data.balanceGeneral.totalPasivos)}
                    </span>
                  </div>
                </SectionCard>

                {/* 3. PATRIMONIO */}
                <SectionCard title="3. PATRIMONIO NETO" bodyClassName="ecu-section-card__body--padded">
                  <div className="space-y-2 pl-2 mb-4">
                    {data.balanceGeneral.patrimonio.map((grp) => (
                      <div
                        key={grp.groupCode}
                        className="flex justify-between items-center py-1.5 px-3 text-sm border-b border-slate-100 dark:border-slate-800/50"
                      >
                        <span className="text-slate-700 dark:text-slate-300">
                          <strong className="font-mono text-xs text-slate-400 mr-2">
                            {grp.groupCode}
                          </strong>
                          {grp.groupName}
                        </span>
                        <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(grp.total)}
                        </span>
                      </div>
                    ))}

                    {/* Línea obligatoria NIIF: Utilidad o Pérdida del Ejercicio */}
                    <div className="flex justify-between items-center py-1.5 px-3 text-sm border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">
                        <strong className="font-mono text-xs text-slate-400 mr-2">3.5.01</strong>
                        Resultado / Utilidad del Ejercicio
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          data.balanceGeneral.utilidadDelEjercicio >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatCurrency(data.balanceGeneral.utilidadDelEjercicio)}
                      </span>
                    </div>
                  </div>

                  {/* Total Patrimonio */}
                  <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg font-bold text-sm text-purple-900 dark:text-purple-200 border border-purple-100 dark:border-purple-900/50 mb-3">
                    <span>TOTAL PATRIMONIO NETO</span>
                    <span className="font-mono text-base">
                      {formatCurrency(data.balanceGeneral.totalPatrimonioNeto)}
                    </span>
                  </div>

                  {/* Total Pasivo y Patrimonio */}
                  <div className="flex justify-between items-center p-3 bg-slate-900 text-white dark:bg-slate-800 rounded-lg font-bold text-sm">
                    <span>TOTAL PASIVO Y PATRIMONIO</span>
                    <span className="font-mono text-base">
                      {formatCurrency(data.balanceGeneral.totalPasivoYPatrimonio)}
                    </span>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        ) : (
          /* PESTAÑA: ESTADO DE RESULTADOS INTEGRAL (P&G) */
          <div className="space-y-6">
            <SectionCard
              title={`Estado de Resultados Integral — ${data.periodName}`}
              bodyClassName="ecu-section-card__body--padded"
            >
              <div className="max-w-4xl mx-auto divide-y divide-slate-100 dark:divide-slate-800">
                {/* 1. Ingresos Operacionales */}
                <div className="py-4 space-y-2">
                  <div className="flex justify-between items-center font-bold text-base text-slate-900 dark:text-slate-100">
                    <span>(+) INGRESOS DE ACTIVIDADES ORDINARIAS</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(data.estadoResultados.totalIngresosOperacionales)}
                    </span>
                  </div>
                  <div className="pl-6 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between items-center">
                      <span>Ventas Locales Tarifa 15% (Casillero 401 SRI)</span>
                      <span className="font-mono">
                        {formatCurrency(data.estadoResultados.ventasNetasTarifa15)}
                      </span>
                    </div>
                    {data.estadoResultados.ventasNetasTarifa0 > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Ventas Locales Tarifa 0% (Casillero 403 SRI)</span>
                        <span className="font-mono">
                          {formatCurrency(data.estadoResultados.ventasNetasTarifa0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Costo de Ventas */}
                <div className="py-4 space-y-2">
                  <div className="flex justify-between items-center font-bold text-base text-slate-900 dark:text-slate-100">
                    <span>(-) COSTO DE VENTAS Y PRODUCCIÓN</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      ({formatCurrency(data.estadoResultados.costoDeVentas)})
                    </span>
                  </div>
                </div>

                {/* 3. Utilidad Bruta */}
                <div className="py-4 bg-slate-50 dark:bg-slate-900/50 px-4 rounded-xl flex justify-between items-center font-bold text-base text-slate-900 dark:text-slate-100">
                  <span>(=) UTILIDAD BRUTA EN VENTAS</span>
                  <span
                    className={`font-mono text-lg ${
                      data.estadoResultados.utilidadBruta >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(data.estadoResultados.utilidadBruta)}
                  </span>
                </div>

                {/* 4. Gastos Operacionales */}
                <div className="py-4 space-y-2">
                  <div className="flex justify-between items-center font-bold text-base text-slate-900 dark:text-slate-100">
                    <span>(-) GASTOS OPERACIONALES</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      ({formatCurrency(data.estadoResultados.totalGastosOperacionales)})
                    </span>
                  </div>
                  <div className="pl-6 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between items-center">
                      <span>Gastos de Administración y Operación</span>
                      <span className="font-mono">
                        {formatCurrency(data.estadoResultados.gastosAdministracion)}
                      </span>
                    </div>
                    {data.estadoResultados.gastosVentasYMarketing > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Gastos de Ventas, Marketing y Pauta Digital</span>
                        <span className="font-mono">
                          {formatCurrency(data.estadoResultados.gastosVentasYMarketing)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Utilidad Operativa */}
                <div className="py-4 flex justify-between items-center font-bold text-base text-slate-900 dark:text-slate-100">
                  <span>(=) UTILIDAD OPERACIONAL (EBITDA)</span>
                  <span className="font-mono text-base">
                    {formatCurrency(data.estadoResultados.utilidadOperativa)}
                  </span>
                </div>

                {/* 6. 15% Trabajadores */}
                <div className="py-4 space-y-1 text-sm">
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span>(-) 15% Participación de Trabajadores (Art. 97 C.T. Ecuador)</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      ({formatCurrency(data.estadoResultados.participacionTrabajadores15)})
                    </span>
                  </div>
                </div>

                {/* 7. Utilidad antes de Impuestos */}
                <div className="py-4 flex justify-between items-center font-semibold text-sm text-slate-800 dark:text-slate-200">
                  <span>(=) UTILIDAD ANTES DE IMPUESTO A LA RENTA</span>
                  <span className="font-mono">
                    {formatCurrency(data.estadoResultados.utilidadAntesDeImpuestos)}
                  </span>
                </div>

                {/* 8. 25% Impuesto a la Renta */}
                <div className="py-4 space-y-1 text-sm">
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span>(-) 25% Provisión Impuesto a la Renta Sociedades (SRI)</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      ({formatCurrency(data.estadoResultados.impuestoRentaEstimado25)})
                    </span>
                  </div>
                </div>

                {/* 9. Utilidad Neta Final */}
                <div className="py-5 bg-emerald-50 dark:bg-emerald-950/40 px-6 rounded-xl flex justify-between items-center font-bold text-lg text-emerald-900 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-800">
                  <span>(=) UTILIDAD NETA DEL EJERCICIO</span>
                  <span className="font-mono text-2xl font-black">
                    {formatCurrency(data.estadoResultados.utilidadNetaEjercicio)}
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </TenantSessionGate>
  )
}
