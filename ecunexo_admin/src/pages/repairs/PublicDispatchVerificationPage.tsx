import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, FileCheck2, Printer, ShieldCheck, XCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import { verifyDispatchPublic } from '@/services/repairsApi'
import type { PublicDispatchVerificationDto } from '@/types/repairsApi'

export function PublicDispatchVerificationPage() {
  const { verificationHash } = useParams<{ verificationHash: string }>()
  const [data, setData] = useState<PublicDispatchVerificationDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!verificationHash) return
    let active = true

    void (async () => {
      setLoading(true)
      try {
        const result = await verifyDispatchPublic(verificationHash)
        if (active) {
          setData(result)
          setError(null)
        }
      } catch (err: unknown) {
        if (active) {
          setError(readApiError(err, 'No se pudo verificar el código del despacho.'))
          setData(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [verificationHash])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center justify-center font-sans text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Cabecera de Verificación */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-inner">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 border border-white/30 mb-2">
            Verificación Oficial EcuNexo Taller
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Acta de Despacho Certificada
          </h1>
          <p className="text-xs text-emerald-100 mt-1">
            Validación criptográfica en tiempo real de salida autorizada de equipos
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Verificando firma digital en el servidor...</p>
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <XCircle className="w-14 h-14 text-rose-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Código No Válido o No Encontrado
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                El hash de verificación proporcionado no coincide con ningún despacho oficial
                emitido por el taller.
              </p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Sello de Autenticidad */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                    Documento Auténtico y Vigente
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Este despacho fue emitido y autorizado por la administración del taller.
                  </p>
                </div>
              </div>

              {/* Ficha Resumen */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <span className="text-slate-500">Número de Acta:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {data.dispatchNumber}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <span className="text-slate-500">Cliente Corporativo:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data.customerName}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <span className="text-slate-500">Conductor / Transportista:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {data.carrierName ?? 'No registrado'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <span className="text-slate-500">Placa de Vehículo:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {data.carrierVehiclePlate ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <span className="text-slate-500">Fecha y Hora de Salida:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {data.dispatchedAt ? formatDateTime(data.dispatchedAt) : 'En tránsito'}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Total Equipos Autorizados:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {data.totalEquipments} unidades
                  </span>
                </div>
              </div>

              {/* Lista de Equipos */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  Equipos Incluidos en el Despacho ({data.equipments.length})
                </h3>
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {data.equipments.map((eq, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white block">
                          {eq.serialNumber}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {eq.brand} {eq.model}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {eq.damageLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acciones */}
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow hover:opacity-90 transition-opacity cursor-pointer border-none"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Comprobante de Entrega
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
          EcuNexo Cloud Platform · Sistema de Reacondicionamiento de Lotes Taller B2B
        </div>
      </div>
    </div>
  )
}
