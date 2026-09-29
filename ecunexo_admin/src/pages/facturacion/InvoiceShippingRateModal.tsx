import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Button, Popup, TextBox } from 'glubox'
import { CheckCircle, HelpCircle, RefreshCw, Truck } from 'lucide-react'
import { formatMoney } from '@/pages/catalog/pricing/pricingFormat'
import { resolveShippingRates } from '@/services/shippingApi'
import type { ResolvedShippingOptionDto } from '@/types/shippingApi'

export type InvoiceShippingRateModalProps = {
  readonly open: boolean
  readonly onClose: () => void
  readonly tenantId: string | null
  readonly totalUnits: number
  readonly subtotalAmount: number
  readonly onSelectShippingRate: (rate: ResolvedShippingOptionDto) => void
}

const COMMON_ZONES = ['Local', 'Provincia', 'Galapagos', 'Oriente']

export function InvoiceShippingRateModal({
  open,
  onClose,
  tenantId,
  totalUnits,
  subtotalAmount,
  onSelectShippingRate,
}: InvoiceShippingRateModalProps) {
  const [zone, setZone] = useState('Provincia')
  const [options, setOptions] = useState<ResolvedShippingOptionDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRates = useCallback(async () => {
    if (!tenantId || !open) return
    setLoading(true)
    setError(null)
    try {
      const data = await resolveShippingRates(tenantId, {
        zone: zone.trim() || null,
        totalQuantity: Math.max(1, totalUnits),
        totalOrderAmount: subtotalAmount,
      })
      setOptions(data)
    } catch {
      setError('No se pudieron resolver las tarifas de envío para los parámetros seleccionados.')
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [tenantId, open, zone, totalUnits, subtotalAmount])

  useEffect(() => {
    if (open) {
      void fetchRates()
    }
  }, [open, fetchRates])

  const handleSelect = (opt: ResolvedShippingOptionDto) => {
    onSelectShippingRate(opt)
    onClose()
  }

  return (
    <Popup
      open={open}
      onClose={onClose}
      title="Agregar Servicio de Envío / Flete"
      width="min(92vw, 36rem)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
        {/* Resumen de carga a despachar */}
        <div
          style={{
            backgroundColor: 'var(--glb-surface-variant, #f8fafc)',
            border: '1px solid var(--glb-border, #e2e8f0)',
            borderRadius: '6px',
            padding: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--glb-muted, #64748b)' }}>Volumen en factura:</span>{' '}
            <strong>{totalUnits} unidades</strong>
          </div>
          <div>
            <span style={{ color: 'var(--glb-muted, #64748b)' }}>Subtotal productos:</span>{' '}
            <strong>{formatMoney(subtotalAmount)}</strong>
          </div>
        </div>

        {/* Selector de Zona */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            Zona de Destino:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <TextBox
                value={zone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setZone(e.target.value)}
                placeholder="Ej: Local, Provincia, Galapagos"
                labelPosition="outlined"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchRates()}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Buscar
            </Button>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
            {COMMON_ZONES.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZone(z)}
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  border: zone === z ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  background: zone === z ? '#e0f2fe' : '#ffffff',
                  color: zone === z ? '#0369a1' : '#334155',
                  cursor: 'pointer',
                  fontWeight: zone === z ? 600 : 400,
                }}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p style={{ color: '#ef4444', fontSize: '0.8rem' }} role="alert">
            {error}
          </p>
        ) : null}

        {/* Lista de opciones resueltas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--glb-muted, #64748b)' }}>
              Consultando matriz de envíos...
            </div>
          ) : options.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--glb-muted, #64748b)', fontSize: '0.85rem' }}>
              No se encontraron tarifas configuradas para la zona &quot;{zone}&quot;. Puedes configurarlas en <strong>Catálogo → Tarifas de Envío</strong>.
            </div>
          ) : (
            options.map((opt) => (
              <div
                key={opt.ruleId}
                style={{
                  border: opt.isRecommended ? '2px solid #16a34a' : '1px solid var(--glb-border, #e2e8f0)',
                  backgroundColor: opt.isRecommended ? 'rgba(22, 163, 74, 0.03)' : 'var(--glb-surface, #ffffff)',
                  borderRadius: '8px',
                  padding: '0.875rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Truck size={16} style={{ color: '#0284c7' }} />
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{opt.name}</span>
                    {opt.isRecommended ? (
                      <span
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.4rem',
                          borderRadius: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        <CheckCircle size={10} /> Recomendado
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>
                    Transportista: <strong>{opt.carrier}</strong> • Zona: {opt.zone}
                    {opt.estimatedDays ? ` • Entrega: ${opt.estimatedDays}` : ''}
                  </div>

                  {opt.notes ? (
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem', fontStyle: 'italic' }}>
                      {opt.notes}
                    </div>
                  ) : null}

                  {!opt.isEligible && opt.unitsNeeded ? (
                    <div
                      style={{
                        marginTop: '0.35rem',
                        fontSize: '0.75rem',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <HelpCircle size={12} />
                      <span>Faltan <strong>{opt.unitsNeeded} unidades</strong> para calificar a esta tarifa por volumen.</span>
                    </div>
                  ) : null}
                </div>

                <div style={{ textAlign: 'right', minWidth: '130px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    {formatMoney(opt.totalPrice)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--glb-muted, #64748b)', marginBottom: '0.5rem' }}>
                    Base {formatMoney(opt.basePrice)} + 15% IVA
                  </div>
                  <Button
                    type="button"
                    variant={opt.isRecommended ? 'primary' : 'outline'}
                    size="sm"
                    disabled={!opt.isEligible}
                    onClick={() => handleSelect(opt)}
                  >
                    Agregar a factura
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Popup>
  )
}
