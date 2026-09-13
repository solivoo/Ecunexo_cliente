import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Copy, FileCheck2, Printer, ShieldCheck, XCircle } from 'lucide-react'
import { StatusBadge } from '@/components/ui'
import { formatDateTime } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import { verifyDispatchPublic } from '@/services/repairsApi'
import type { PublicDispatchVerificationDto } from '@/types/repairsApi'
import './public-dispatch-verification.css'

export function PublicDispatchVerificationPage() {
  const { verificationHash } = useParams<{ verificationHash: string }>()
  const [data, setData] = useState<PublicDispatchVerificationDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState(false)

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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignorar fallback
    }
  }

  const filteredEquipments = useMemo(() => {
    if (!data?.equipments) return []
    const term = searchTerm.trim().toLowerCase()
    if (!term) return data.equipments
    return data.equipments.filter(
      (eq) =>
        eq.serialNumber.toLowerCase().includes(term) ||
        eq.model.toLowerCase().includes(term) ||
        eq.brand.toLowerCase().includes(term) ||
        eq.damageLevel.toLowerCase().includes(term)
    )
  }, [data?.equipments, searchTerm])

  return (
    <div className="ecu-public-verify">
      <main className="ecu-public-verify__card" role="main">
        {/* Cabecera de Verificación Oficial */}
        <header className="ecu-public-verify__header">
          <div className="ecu-public-verify__shield" aria-hidden="true">
            <ShieldCheck className="ecu-public-verify__shield-icon" />
          </div>
          <br />
          <span className="ecu-public-verify__tag">Verificación Oficial EcuNexo Taller</span>
          <h1 className="ecu-public-verify__title">Acta de Despacho Certificada</h1>
          <p className="ecu-public-verify__subtitle">
            Validación criptográfica en tiempo real de salida autorizada de equipos
          </p>
        </header>

        <div className="ecu-public-verify__body">
          {loading ? (
            <div className="ecu-public-verify__loading">
              <div className="ecu-public-verify__spinner" aria-hidden="true" />
              <p className="ecu-public-verify__error-text">Verificando firma digital en el servidor...</p>
            </div>
          ) : error ? (
            <div className="ecu-public-verify__error">
              <XCircle className="ecu-public-verify__error-icon" aria-hidden="true" />
              <h2 className="ecu-public-verify__error-title">Código No Válido o No Encontrado</h2>
              <p className="ecu-public-verify__error-text">
                El hash de verificación proporcionado no coincide con ningún despacho oficial emitido por el taller.
              </p>
            </div>
          ) : data ? (
            <>
              {/* Sello de Autenticidad */}
              <div className="ecu-public-verify__seal">
                <CheckCircle2 className="ecu-public-verify__seal-icon" aria-hidden="true" />
                <div>
                  <h2 className="ecu-public-verify__seal-title">Documento Auténtico y Vigente</h2>
                  <p className="ecu-public-verify__seal-desc">
                    Este despacho fue emitido y autorizado por la administración del taller técnico.
                  </p>
                </div>
              </div>

              {/* Ficha Resumen */}
              <section className="ecu-public-verify__meta" aria-label="Resumen del despacho">
                <div className="ecu-public-verify__meta-row">
                  <span className="ecu-public-verify__meta-label">Número de Acta:</span>
                  <span className="ecu-public-verify__meta-value ecu-public-verify__meta-value--mono">
                    {data.dispatchNumber}
                  </span>
                </div>
                <div className="ecu-public-verify__meta-row">
                  <span className="ecu-public-verify__meta-label">Cliente Corporativo:</span>
                  <span className="ecu-public-verify__meta-value">{data.customerName}</span>
                </div>
                <div className="ecu-public-verify__meta-row">
                  <span className="ecu-public-verify__meta-label">Conductor / Transportista:</span>
                  <span className="ecu-public-verify__meta-value">
                    {data.carrierName || 'No registrado'}
                  </span>
                </div>
                <div className="ecu-public-verify__meta-row">
                  <span className="ecu-public-verify__meta-label">Placa de Vehículo:</span>
                  <span className="ecu-public-verify__meta-value ecu-public-verify__meta-value--mono">
                    {data.carrierVehiclePlate ?? '—'}
                  </span>
                </div>
                <div className="ecu-public-verify__meta-row">
                  <span className="ecu-public-verify__meta-label">Fecha de Salida:</span>
                  <span className="ecu-public-verify__meta-value">
                    {data.dispatchedAt ? formatDateTime(data.dispatchedAt) : 'En tránsito'}
                  </span>
                </div>
                <div className="ecu-public-verify__meta-row">
                  <span className="ecu-public-verify__meta-label">Total Equipos:</span>
                  <span className="ecu-public-verify__meta-value ecu-public-verify__meta-value--highlight">
                    {data.totalEquipments} unidades
                  </span>
                </div>
              </section>

              {/* Lista de Equipos con buscador rápido para celular */}
              <section className="ecu-public-verify__equipments" aria-label="Equipos incluidos">
                <div className="ecu-public-verify__equipments-head">
                  <h3 className="ecu-public-verify__section-title">
                    <FileCheck2 size={16} strokeWidth={2} aria-hidden="true" />
                    Equipos en el Acta ({data.equipments.length})
                  </h3>
                </div>

                {data.equipments.length > 3 && (
                  <input
                    type="search"
                    className="ecu-public-verify__search-input"
                    placeholder="Buscar serie, modelo o marca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Buscar serie o modelo de equipo"
                  />
                )}

                <div className="ecu-public-verify__list" role="list">
                  {filteredEquipments.length === 0 ? (
                    <div className="ecu-public-verify__empty-search">
                      No se encontraron equipos con el criterio "{searchTerm}".
                    </div>
                  ) : (
                    filteredEquipments.map((eq, idx) => (
                      <div key={idx} className="ecu-public-verify__item" role="listitem">
                        <div className="ecu-public-verify__item-main">
                          <span className="ecu-public-verify__item-serial">{eq.serialNumber}</span>
                          <span className="ecu-public-verify__item-model">
                            {eq.brand} · {eq.model}
                          </span>
                        </div>
                        <StatusBadge tone="neutral">{eq.damageLevel}</StatusBadge>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Acreditación de Custodia y Firmas */}
              <section className="ecu-public-verify__custody" aria-label="Traspaso de custodia">
                <h4 className="ecu-public-verify__section-title">Acreditación de Traspaso de Custodia</h4>
                <div className="ecu-public-verify__custody-grid">
                  <div className="ecu-public-verify__custody-card">
                    <div>
                      <span className="ecu-public-verify__custody-role">
                        Conductor / Solicitante de Retiro
                      </span>
                      <p className="ecu-public-verify__custody-name">
                        {data.carrierName || 'Conductor Asignado'}
                      </p>
                      {data.carrierVehiclePlate && (
                        <p className="ecu-public-verify__custody-meta">
                          Vehículo:{' '}
                          <strong style={{ fontFamily: 'ui-monospace, monospace' }}>
                            {data.carrierVehiclePlate}
                          </strong>
                        </p>
                      )}
                    </div>
                    <div className="ecu-public-verify__custody-sign-line">
                      Firma de Recepción Conforme
                    </div>
                  </div>

                  <div className="ecu-public-verify__custody-card">
                    <div>
                      <span className="ecu-public-verify__custody-role">Aprobación de Salida / Taller</span>
                      <p className="ecu-public-verify__custody-name">Responsable de Control y Despacho</p>
                      <p className="ecu-public-verify__custody-meta">
                        {data.dispatchedAt ? formatDateTime(data.dispatchedAt) : 'Salida autorizada'}
                      </p>
                    </div>
                    <div className="ecu-public-verify__custody-sign-line">Firma Autorizada y Sello</div>
                  </div>
                </div>
              </section>

              {/* Acciones para Móvil y Desktop */}
              <div className="ecu-public-verify__actions">
                <button
                  type="button"
                  className="ecu-public-verify__btn ecu-public-verify__btn--primary"
                  onClick={handlePrint}
                >
                  <Printer size={15} strokeWidth={2} aria-hidden="true" />
                  Imprimir Comprobante
                </button>
                <button
                  type="button"
                  className="ecu-public-verify__btn ecu-public-verify__btn--outline"
                  onClick={() => void handleCopyLink()}
                >
                  <Copy size={15} strokeWidth={2} aria-hidden="true" />
                  {copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <footer className="ecu-public-verify__footer">
          <div>EcuNexo Cloud Platform · Sistema de Reacondicionamiento de Lotes Taller B2B</div>
          {verificationHash && (
            <div className="ecu-public-verify__hash" title="Hash criptográfico">
              Hash: {verificationHash}
            </div>
          )}
        </footer>
      </main>
    </div>
  )
}

