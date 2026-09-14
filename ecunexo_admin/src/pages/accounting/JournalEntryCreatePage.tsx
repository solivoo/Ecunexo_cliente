import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox } from 'glubox'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { useAppToast } from '@/components/toast/useAppToast'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { readApiError } from '@/lib/readApiError'
import { listAccounts } from '@/services/accountingApi'
import { createManualJournalEntry } from '@/services/journalEntriesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { AccountDto } from '@/types/accountingApi'
import '@/pages/repairs/ecu-customer-form.css'

interface EntryLineItem {
  id: string
  accountId: string
  debit: string
  credit: string
  description: string
}

export default function JournalEntryCreatePage() {
  const tenantId = useAppSelector(selectTenantId)
  const toast = useAppToast()
  const navigate = useNavigate()

  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [accounts, setAccounts] = useState<AccountDto[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Cabecera
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [autoPost, setAutoPost] = useState(true)

  // Líneas
  const [lines, setLines] = useState<EntryLineItem[]>([
    { id: '1', accountId: '', debit: '0.00', credit: '0.00', description: '' },
    { id: '2', accountId: '', debit: '0.00', credit: '0.00', description: '' },
  ])

  // Cargar cuentas auxiliares que permiten movimiento
  const fetchAccounts = useCallback(async () => {
    if (!tenantId) return
    setLoadingAccounts(true)
    try {
      const data = await listAccounts(tenantId, {
        allowsMovementOnly: true,
        activeOnly: true,
      })
      setAccounts(data)
    } catch (err) {
      toast.error(
        'Error al cargar catálogo de cuentas',
        readApiError(err, 'No se pudieron listar las cuentas contables.')
      )
    } finally {
      setLoadingAccounts(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Opciones para el Select
  const accountOptions = useMemo(() => {
    return accounts.map((a) => ({
      value: a.id,
      label: `${a.code} — ${a.name}`,
    }))
  }, [accounts])

  // Manejo de líneas
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        accountId: '',
        debit: '0.00',
        credit: '0.00',
        description: '',
      },
    ])
  }

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) {
      toast.warning(
        'Mínimo de líneas requerido',
        'Todo asiento contable requiere al menos 2 líneas para partida doble.'
      )
      return
    }
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleLineChange = (id: string, field: keyof EntryLineItem, val: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line
        // Si ingresa débito mayor a 0, limpiar crédito
        if (field === 'debit' && parseFloat(val) > 0) {
          return { ...line, debit: val, credit: '0.00' }
        }
        // Si ingresa crédito mayor a 0, limpiar débito
        if (field === 'credit' && parseFloat(val) > 0) {
          return { ...line, credit: val, debit: '0.00' }
        }
        return { ...line, [field]: val }
      })
    )
  }

  // Cálculos de Totales y Cuadre
  const totals = useMemo(() => {
    let totalDebit = 0
    let totalCredit = 0

    for (const line of lines) {
      const d = parseFloat(line.debit) || 0
      const c = parseFloat(line.credit) || 0
      totalDebit += d
      totalCredit += c
    }

    const diff = Math.abs(totalDebit - totalCredit)
    const isBalanced = diff < 0.005 && totalDebit > 0

    return {
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      diff: Math.round(diff * 100) / 100,
      isBalanced,
    }
  }, [lines])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val)

  // Guardar asiento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) return

    if (!description.trim()) {
      toast.warning(
        'Glosa obligatoria',
        'Ingrese el concepto o glosa general del asiento contable.'
      )
      return
    }

    // Validar líneas
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.accountId) {
        toast.warning(
          `Línea #${i + 1} incompleta`,
          'Seleccione una cuenta contable para cada línea.'
        )
        return
      }

      const d = parseFloat(line.debit) || 0
      const c = parseFloat(line.credit) || 0
      if (d === 0 && c === 0) {
        toast.warning(
          `Línea #${i + 1} sin importe`,
          'Debe ingresar un monto en el Debe o en el Haber.'
        )
        return
      }
    }

    if (autoPost && !totals.isBalanced) {
      toast.error(
        'Asiento descuadrado',
        `El asiento no cumple el principio de partida doble. Diferencia: ${formatCurrency(totals.diff)}`
      )
      return
    }

    setSubmitting(true)
    try {
      await createManualJournalEntry(tenantId, {
        date,
        description: description.trim(),
        autoPost,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description.trim() || undefined,
        })),
      })

      toast.success(
        'Asiento contable registrado',
        autoPost
          ? 'El asiento fue contabilizado exitosamente en el Libro Diario.'
          : 'El asiento fue guardado en borrador.'
      )

      navigate('/contabilidad/asientos')
    } catch (err) {
      toast.error(
        'Error al registrar asiento',
        readApiError(err, 'No se pudo guardar el asiento contable.')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <TenantSessionGate
      title="Nuevo Asiento Contable"
      lead="Comprobante de diario manual para ajustes, aperturas o transacciones operativas."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Nuevo Asiento Contable"
          subtitle="Comprobante de diario manual para ajustes, aperturas o transacciones operativas."
          badge={
            <StatusBadge tone="primary" withDot>
              Partida Doble NIIF
            </StatusBadge>
          }
          actions={
            <Button
              variant="outline"
              onClick={() => navigate('/contabilidad/asientos')}
              disabled={submitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Libro Diario
            </Button>
          }
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cabecera del Asiento */}
          <SectionCard title="Datos Generales del Comprobante">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Fecha Contable *
                </label>
                <TextBox
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Glosa / Concepto General *
                </label>
                <TextBox
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Registro de pago de servicios o ajuste de saldos iniciales"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="autoPostCheckbox"
                checked={autoPost}
                onChange={(e) => setAutoPost(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="autoPostCheckbox" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Contabilizar inmediatamente (valida partida doble estricta)
              </label>
            </div>
          </SectionCard>

          {/* Grilla de Apuntes (Líneas) */}
          <SectionCard title="Detalle de Cuentas y Apuntes">
            {loadingAccounts ? (
              <div className="py-8 text-center text-slate-500">
                Cargando catálogo de cuentas imputables...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">#</th>
                        <th className="py-3 px-3 min-w-[280px]">Cuenta Contable *</th>
                        <th className="py-3 px-3 w-36 text-right">Debe ($)</th>
                        <th className="py-3 px-3 w-36 text-right">Haber ($)</th>
                        <th className="py-3 px-3 min-w-[200px]">Detalle / Referencia</th>
                        <th className="py-3 px-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lines.map((line, idx) => (
                        <tr key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <Select
                              id={`entry-line-account-${idx}`}
                              value={line.accountId}
                              onChange={(val) => handleLineChange(line.id, 'accountId', String(val))}
                              options={accountOptions}
                              placeholder="Seleccione cuenta..."
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <TextBox
                              id={`entry-line-debit-${idx}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.debit}
                              onChange={(e) => handleLineChange(line.id, 'debit', e.target.value)}
                              className="text-right font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <TextBox
                              id={`entry-line-credit-${idx}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.credit}
                              onChange={(e) => handleLineChange(line.id, 'credit', e.target.value)}
                              className="text-right font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <TextBox
                              value={line.description}
                              onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                              placeholder="Glosa específica..."
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveLine(line.id)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-none p-1.5"
                              title="Eliminar apunte"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddLine}
                    className="text-slate-700 dark:text-slate-300 font-medium"
                  >
                    <Plus className="w-4 h-4 mr-1.5 text-indigo-500" />
                    Agregar Línea
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Barra de Cuadre y Totales */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div className="text-center sm:text-left">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Total Debe
                </span>
                <span className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-100">
                  {formatCurrency(totals.totalDebit)}
                </span>
              </div>

              <div className="text-center sm:text-left">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Total Haber
                </span>
                <span className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-100">
                  {formatCurrency(totals.totalCredit)}
                </span>
              </div>

              <div className="text-center sm:text-right">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Diferencia
                </span>
                <span
                  className={`text-2xl font-mono font-bold ${
                    totals.isBalanced
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(totals.diff)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {totals.isBalanced ? (
                  <div className="flex items-center text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Partida Doble Cuadrada: el asiento cumple con las normas NIIF.
                  </div>
                ) : (
                  <div className="flex items-center text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-lg">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Asiento Descuadrado: debe igualar Debe y Haber para contabilizar.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/contabilidad/asientos')}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || (autoPost && !totals.isBalanced)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {submitting ? 'Guardando...' : autoPost ? 'Contabilizar Asiento' : 'Guardar Borrador'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </TenantSessionGate>
  )
}
