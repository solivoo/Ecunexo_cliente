import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Popup, Select } from 'glubox'
import { CheckCircle, MapPin, RefreshCw, Truck } from 'lucide-react'
import { formatMoney } from '@/pages/catalog/pricing/pricingFormat'
import {
  listCantonShippingRates,
  listEcuadorProvinces,
  listShippingMethods,
} from '@/services/shippingApi'
import type {
  CantonShippingRateItemDto,
  EcuadorProvinceDto,
  InvoiceShippingSelectionDto,
  ShippingMethodDto,
} from '@/types/shippingApi'

export type InvoiceShippingRateModalProps = {
  readonly open: boolean
  readonly onClose: () => void
  readonly tenantId: string | null
  readonly totalUnits: number
  readonly subtotalAmount: number
  readonly onSelectShippingRate: (rate: InvoiceShippingSelectionDto) => void
}

export function InvoiceShippingRateModal({
  open,
  onClose,
  tenantId,
  totalUnits,
  subtotalAmount,
  onSelectShippingRate,
}: InvoiceShippingRateModalProps) {
  const [provinces, setProvinces] = useState<EcuadorProvinceDto[]>([])
  const [methods, setMethods] = useState<ShippingMethodDto[]>([])
  const [provinceId, setProvinceId] = useState<string>('')
  const [methodId, setMethodId] = useState<string>('')
  const [rates, setRates] = useState<CantonShippingRateItemDto[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)
  const [loadingRates, setLoadingRates] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !tenantId) return
    let cancelled = false
    const load = async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoadingCatalogs(true)
      setError(null)
      try {
        const [provList, methodList] = await Promise.all([
          listEcuadorProvinces(),
          listShippingMethods(tenantId, { onlyActive: true }),
        ])
        if (cancelled) return
        setProvinces(provList)
        setMethods(methodList)
        setProvinceId((prev) => prev || provList[0]?.id || '')
        setMethodId((prev) => prev || methodList[0]?.id || '')
      } catch {
        if (!cancelled) {
          setError('No se pudieron cargar las provincias o métodos de envío.')
        }
      } finally {
        if (!cancelled) setLoadingCatalogs(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, tenantId])

  const fetchCantonRates = useCallback(async () => {
    if (!open || !tenantId || !provinceId) return
    setLoadingRates(true)
    setError(null)
    try {
      const data = await listCantonShippingRates(tenantId, provinceId, methodId || null)
      setRates(data.filter((r) => r.isConfigured && r.isEnabled))
    } catch {
      setError('No se pudieron consultar las tarifas configuradas para la provincia seleccionada.')
      setRates([])
    } finally {
      setLoadingRates(false)
    }
  }, [open, tenantId, provinceId, methodId])

  useEffect(() => {
    if (!open || !tenantId || !provinceId) return
    let cancelled = false
    const loadRates = async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoadingRates(true)
      setError(null)
      try {
        const data = await listCantonShippingRates(tenantId, provinceId, methodId || null)
        if (!cancelled) {
          setRates(data.filter((r) => r.isConfigured && r.isEnabled))
        }
      } catch {
        if (!cancelled) {
          setError('No se pudieron consultar las tarifas configuradas para la provincia seleccionada.')
          setRates([])
        }
      } finally {
        if (!cancelled) setLoadingRates(false)
      }
    }
    void loadRates()
    return () => {
      cancelled = true
    }
  }, [open, tenantId, provinceId, methodId])

  const selectedProvince = useMemo(
    () => provinces.find((p) => p.id === provinceId) ?? null,
    [provinces, provinceId]
  )
  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === methodId) ?? null,
    [methods, methodId]
  )

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.id, label: p.name })),
    [provinces]
  )
  const methodOptions = useMemo(
    () => methods.map((m) => ({ value: m.id, label: m.name })),
    [methods]
  )

  const handleSelect = (item: CantonShippingRateItemDto) => {
    const isFree =
      item.freeShippingMinAmount !== null &&
      item.freeShippingMinAmount > 0 &&
      subtotalAmount >= item.freeShippingMinAmount
    const basePrice = isFree ? 0 : item.basePrice
    const taxRate = item.taxRate ?? 15
    const taxAmount = Math.round(basePrice * (taxRate / 100) * 100) / 100
    const totalPrice = Math.round((basePrice + taxAmount) * 100) / 100

    onSelectShippingRate({
      cantonId: item.cantonId,
      cantonName: item.cantonName,
      provinceName: selectedProvince?.name ?? '',
      methodName: selectedMethod?.name ?? 'Envío estándar',
      basePrice,
      taxRate,
      taxAmount,
      totalPrice,
      isFreeShipping: isFree,
      estimatedDays: item.estimatedDays ?? selectedMethod?.estimatedDays ?? null,
    })
    onClose()
  }

  const loading = loadingCatalogs || loadingRates

  return (
    <Popup
      open={open}
      onClose={onClose}
      title="Agregar Servicio de Envío / Flete"
      width="min(92vw, 38rem)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
        <div
          style={{
            backgroundColor: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.08))',
            border: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
            color: 'var(--glb-text, var(--shell-text, inherit))',
          }}
        >
          <div>
            <span style={{ color: 'var(--glb-muted, var(--shell-muted, #94a3b8))' }}>Volumen en factura:</span>{' '}
            <strong style={{ color: 'var(--glb-text, var(--shell-text, inherit))' }}>{totalUnits} unidades</strong>
          </div>
          <div>
            <span style={{ color: 'var(--glb-muted, var(--shell-muted, #94a3b8))' }}>Subtotal productos:</span>{' '}
            <strong style={{ color: 'var(--glb-text, var(--shell-text, inherit))' }}>{formatMoney(subtotalAmount)}</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', alignItems: 'end' }}>
          <Select
            label="Provincia de destino"
            labelPosition="outlined"
            value={provinceId}
            options={provinceOptions}
            onChange={(val) => setProvinceId(String(val ?? ''))}
            disabled={loadingCatalogs}
          />
          <Select
            label="Método de envío"
            labelPosition="outlined"
            value={methodId}
            options={methodOptions}
            onChange={(val) => setMethodId(String(val ?? ''))}
            disabled={loadingCatalogs || methodOptions.length === 0}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchCantonRates()}
            disabled={loading || !provinceId}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </Button>
        </div>

        {error ? (
          <p style={{ color: '#ef4444', fontSize: '0.8rem' }} role="alert">
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '360px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--glb-muted, #94a3b8)' }}>
              Consultando tarifas por cantón...
            </div>
          ) : rates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--glb-muted, #94a3b8)', fontSize: '0.85rem' }}>
              No hay cantones habilitados para {selectedProvince?.name ?? 'esta provincia'}
              {selectedMethod ? ` con ${selectedMethod.name}` : ''}. Configúralos en{' '}
              <strong>Ecommerce → Envíos → Cantones</strong>.
            </div>
          ) : (
            rates.map((item) => {
              const isFree =
                item.freeShippingMinAmount !== null &&
                item.freeShippingMinAmount > 0 &&
                subtotalAmount >= item.freeShippingMinAmount
              const basePrice = isFree ? 0 : item.basePrice
              const taxRate = item.taxRate ?? 15
              const totalPrice = Math.round(basePrice * (1 + taxRate / 100) * 100) / 100
              const eta = item.estimatedDays ?? selectedMethod?.estimatedDays

              return (
                <div
                  key={item.cantonId}
                  style={{
                    border: isFree ? '2px solid #16a34a' : '1px solid var(--shell-border, rgba(125, 125, 125, 0.25))',
                    backgroundColor: isFree ? 'rgba(22, 163, 74, 0.08)' : 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.04))',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <MapPin size={15} style={{ color: '#0284c7' }} />
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--glb-text, var(--shell-text, inherit))' }}>
                        {item.cantonName}
                      </span>
                      {isFree ? (
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
                          <CheckCircle size={10} /> Envío gratis
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, var(--shell-muted, #94a3b8))', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <Truck size={13} />
                      <span>{selectedMethod?.name ?? 'Envío estándar'}</span>
                      {eta ? <span>• Entrega: {eta}</span> : null}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '130px' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--glb-text, var(--shell-text, inherit))' }}>
                      {formatMoney(totalPrice)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--glb-muted, var(--shell-muted, #94a3b8))', marginBottom: '0.45rem' }}>
                      Base {formatMoney(basePrice)} + {taxRate}% IVA
                    </div>
                    <Button
                      type="button"
                      variant={isFree ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleSelect(item)}
                    >
                      Agregar a factura
                    </Button>
                  </div>
                </div>
              )
            })
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
