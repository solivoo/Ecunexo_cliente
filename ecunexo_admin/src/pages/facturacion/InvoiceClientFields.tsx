import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Button, Select, TextArea, TextBox, useToast } from 'glubox'
import {
  CONSUMIDOR_FINAL_MAX_TOTAL_USD,
  CUSTOMER_TYPE_OPTIONS,
  ID_TYPE_OPTIONS,
  PAYMENT_FORM_OPTIONS,
  customerIdentificationToSriType,
  isConsumidorFinalType,
  type InvoiceCounterpartyValues,
} from '@/pages/facturacion/invoiceFormTypes'
import { createCustomer, listCustomers, lookupCustomerSri } from '@/services/customersApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CustomerDto } from '@/types/customersApi'
import { deriveEcuadorCityFromTaxId } from '@/lib/ecuadorTaxIdValidator'

export type InvoiceClientFieldsProps = {
  readonly counterparty: InvoiceCounterpartyValues
  readonly paymentFormCode: string
  readonly disabled?: boolean
  readonly onCounterpartyChange: <K extends keyof InvoiceCounterpartyValues>(
    key: K,
    value: InvoiceCounterpartyValues[K]
  ) => void
  readonly onCounterpartyReplace?: (next: InvoiceCounterpartyValues) => void
  readonly onPaymentFormChange: (code: string) => void
}

function customerToCounterparty(
  customer: CustomerDto,
  paymentKept: InvoiceCounterpartyValues
): InvoiceCounterpartyValues {
  const identificationType = customerIdentificationToSriType(customer.identificationType)
  if (isConsumidorFinalType(identificationType)) {
    return {
      ...paymentKept,
      identificationType,
      identification: '9999999999999',
      businessName: 'CONSUMIDOR FINAL',
      customerType: 5,
      address: customer.address ?? '',
      city: customer.city ?? '',
      email: customer.contactEmail ?? '',
      phone: customer.contactPhone ?? '',
    }
  }

  return {
    ...paymentKept,
    identificationType,
    identification: customer.taxId?.trim() ?? '',
    businessName: customer.name,
    customerType: customer.customerType ?? 1,
    address: customer.address ?? '',
    city: customer.city ?? '',
    email: customer.contactEmail ?? '',
    phone: customer.contactPhone ?? '',
  }
}

/** Cliente + forma de pago simplificado y consulta automatizada SRI/Ecuador. */
export function InvoiceClientFields({
  counterparty,
  paymentFormCode,
  disabled = false,
  onCounterpartyChange,
  onCounterpartyReplace,
  onPaymentFormChange,
}: InvoiceClientFieldsProps) {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const [directory, setDirectory] = useState<CustomerDto[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [searchingSri, setSearchingSri] = useState(false)
  const [savingDirectory, setSavingDirectory] = useState(false)
  const [lookupBanner, setLookupBanner] = useState<{
    text: string
    type: 'local' | 'sri'
    canSave?: boolean
  } | null>(null)

  const lastSearchedTaxId = useRef<string>('')
  const consumidorFinal = isConsumidorFinalType(counterparty.identificationType)

  const emitParty: InvoiceClientFieldsProps['onCounterpartyChange'] = (key, value) => {
    if (disabled) return
    if (consumidorFinal && (key === 'identification' || key === 'businessName')) return
    setSelectedCustomerId('')
    setLookupBanner(null)
    onCounterpartyChange(key, value)
  }

  const emitPayment = (code: string) => {
    if (disabled) return
    onPaymentFormChange(code)
  }

  useEffect(() => {
    if (!tenantId) {
      setDirectory([])
      return
    }
    let active = true
    void (async () => {
      try {
        const list = await listCustomers(tenantId)
        if (!active) return
        setDirectory(list.filter((c) => c.isActive))
        setDirectoryError(null)
      } catch {
        if (!active) return
        setDirectory([])
        setDirectoryError('No se pudo cargar el directorio de clientes.')
      }
    })()
    return () => {
      active = false
    }
  }, [tenantId])

  const directoryOptions = useMemo(
    () => [
      { value: '', label: 'Seleccionar del directorio comercial registrado…' },
      ...directory.map((c) => ({
        value: c.id,
        label: `${c.name}${c.taxId ? ` · ${c.taxId}` : ''}${c.city ? ` (${c.city})` : ''}`,
      })),
    ],
    [directory]
  )

  const handleDirectorySelect = (customerId: string) => {
    setSelectedCustomerId(customerId)
    if (!customerId || disabled) {
      setLookupBanner(null)
      return
    }
    const customer = directory.find((c) => c.id === customerId)
    if (!customer) return
    const next = customerToCounterparty(customer, counterparty)
    lastSearchedTaxId.current = next.identification.trim()
    if (onCounterpartyReplace) {
      onCounterpartyReplace(next)
    } else {
      onCounterpartyChange('identificationType', next.identificationType)
      onCounterpartyChange('identification', next.identification)
      onCounterpartyChange('businessName', next.businessName)
      onCounterpartyChange('customerType', next.customerType)
      onCounterpartyChange('address', next.address)
      onCounterpartyChange('city', next.city)
      onCounterpartyChange('email', next.email)
      onCounterpartyChange('phone', next.phone)
    }
    setLookupBanner({
      text: `✓ Cliente "${customer.name}" cargado del directorio comercial.`,
      type: 'local',
    })
  }

  const handleLookupSri = async (rawTaxId?: string) => {
    if (!tenantId || disabled) return
    const targetTaxId = (rawTaxId ?? counterparty.identification).trim()
    if (!targetTaxId) return

    setSearchingSri(true)
    lastSearchedTaxId.current = targetTaxId
    try {
      const res = await lookupCustomerSri(tenantId, targetTaxId)
      if (res.foundInLocalDirectory && res.localCustomer) {
        const next = customerToCounterparty(res.localCustomer, counterparty)
        if (onCounterpartyReplace) {
          onCounterpartyReplace(next)
        } else {
          onCounterpartyChange('identificationType', next.identificationType)
          onCounterpartyChange('identification', next.identification)
          onCounterpartyChange('businessName', next.businessName)
          onCounterpartyChange('customerType', next.customerType)
          onCounterpartyChange('address', next.address)
          onCounterpartyChange('city', next.city)
          onCounterpartyChange('email', next.email)
          onCounterpartyChange('phone', next.phone)
        }
        setSelectedCustomerId(res.localCustomer.id)
        setLookupBanner({
          text: `✓ Cliente "${res.localCustomer.name}" encontrado en tu directorio comercial.`,
          type: 'local',
        })
        toast.show({ title: 'Cliente Encontrado', message: `Cliente "${res.localCustomer.name}" registrado en tu directorio.`, variant: 'success' })
      } else {
        const idTypeStr = res.identificationType === 2 ? '05' : res.identificationType === 1 ? '04' : '06'
        const autoCity = res.suggestedCity || deriveEcuadorCityFromTaxId(targetTaxId) || ''

        onCounterpartyChange('identificationType', idTypeStr)
        onCounterpartyChange('identification', targetTaxId)
        if (res.suggestedName && !counterparty.businessName.trim()) {
          onCounterpartyChange('businessName', res.suggestedName)
        }
        onCounterpartyChange('customerType', res.customerType ?? (idTypeStr === '04' ? 1 : 2))
        if (autoCity && !counterparty.city.trim()) {
          onCounterpartyChange('city', autoCity)
        }

        setLookupBanner({
          text: `Autodetectado Ecuador: ${idTypeStr === '04' ? 'RUC' : 'Cédula'} (${autoCity ? `Ciudad sugerida: ${autoCity}` : 'Ecuador'}). Puedes verificar la Razón Social y guardarlo.`,
          type: 'sri',
          canSave: true,
        })
        toast.show({
          title: 'Datos de Ecuador Auto-detectados',
          message: `Identificación válida (${idTypeStr === '04' ? 'RUC' : 'Cédula'}). ${autoCity ? `Ciudad asignada: ${autoCity}.` : ''}`,
          variant: 'info',
        })
      }
    } catch {
      // Fallback local con algoritmo de provincias de Ecuador
      const autoCity = deriveEcuadorCityFromTaxId(targetTaxId) || ''
      const isRuc = targetTaxId.length === 13
      const idTypeStr = isRuc ? '04' : targetTaxId.length === 10 ? '05' : '06'
      onCounterpartyChange('identificationType', idTypeStr)
      if (autoCity && !counterparty.city.trim()) {
        onCounterpartyChange('city', autoCity)
      }
      setLookupBanner({
        text: `Identificación Ecuador analizada (${isRuc ? 'RUC' : 'Cédula'}). ${autoCity ? `Ciudad sugerida: ${autoCity}.` : ''}`,
        type: 'sri',
        canSave: true,
      })
    } finally {
      setSearchingSri(false)
    }
  }

  useEffect(() => {
    const taxId = counterparty.identification.trim()
    if (disabled || consumidorFinal || !tenantId) return
    if (taxId.length !== 10 && taxId.length !== 13) return
    if (taxId === lastSearchedTaxId.current) return

    const timer = setTimeout(() => {
      void handleLookupSri(taxId)
    }, 450)

    return () => clearTimeout(timer)
  }, [counterparty.identification, disabled, consumidorFinal, tenantId])

  const handleQuickSaveCustomer = async () => {
    if (!tenantId || !counterparty.businessName.trim() || disabled || savingDirectory) return
    setSavingDirectory(true)
    try {
      const idTypeNum = counterparty.identificationType === '04' ? 1 : counterparty.identificationType === '05' ? 2 : counterparty.identificationType === '06' ? 3 : 4
      const created = await createCustomer(tenantId, {
        name: counterparty.businessName.trim(),
        taxId: counterparty.identification.trim() || null,
        customerType: (counterparty.customerType as any) || 1,
        identificationType: idTypeNum,
        address: counterparty.address.trim() || null,
        city: counterparty.city.trim() || null,
        contactEmail: counterparty.email.trim() || null,
        contactPhone: counterparty.phone.trim() || null,
        isActive: true,
      })
      setDirectory((prev) => [created, ...prev])
      setSelectedCustomerId(created.id)
      setLookupBanner({
        text: `✓ Cliente "${created.name}" guardado exitosamente en el directorio comercial.`,
        type: 'local',
      })
      toast.show({
        title: 'Directorio Comercial Actualizado',
        message: `El cliente "${created.name}" fue guardado exitosamente.`,
        variant: 'success',
      })
    } catch {
      toast.show({ title: 'Error', message: 'No se pudo guardar el cliente en el directorio.', variant: 'error' })
    } finally {
      setSavingDirectory(false)
    }
  }

  return (
    <section className="factura-emitir__meta-block">
      <header className="factura-emitir__meta-head">
        <h2 className="factura-emitir__meta-label">Datos del Cliente / Adquirente</h2>
      </header>

      {lookupBanner && (
        <div
          className={`factura-emitir__lookup-banner ${
            lookupBanner.type === 'local' ? 'factura-emitir__lookup-banner--local' : ''
          }`}
          role="status"
        >
          <span>{lookupBanner.text}</span>
          {lookupBanner.canSave && counterparty.businessName.trim() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleQuickSaveCustomer()}
              disabled={savingDirectory}
            >
              {savingDirectory ? 'Guardando…' : '＋ Guardar en Directorio'}
            </Button>
          )}
        </div>
      )}

      <div className="factura-emitir__meta-grid factura-emitir__meta-grid--client">
        <div className="factura-emitir__cell factura-emitir__cell--directory">
          <Select
            id="inv-directory-customer"
            label="Buscar en Directorio Comercial Registrado"
            labelPosition="outlined"
            variant="outline"
            options={directoryOptions}
            value={selectedCustomerId}
            onChange={handleDirectorySelect}
            disabled={disabled || directory.length === 0}
            fullWidth
          />
          {directoryError && (
            <p className="factura-emitir__meta-hint" role="alert">
              {directoryError}
            </p>
          )}
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--id-type">
          <Select
            id="inv-id-type"
            label="Tipo ID"
            labelPosition="outlined"
            variant="outline"
            options={[...ID_TYPE_OPTIONS]}
            value={counterparty.identificationType}
            onChange={(v) => emitParty('identificationType', v)}
            disabled={disabled}
            fullWidth
          />
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--id">
          <TextBox
            id="inv-id"
            label={searchingSri ? 'Cédula / RUC (Buscando…)' : 'Cédula / RUC Ecuador'}
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.identification}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const val = e.target.value
              emitParty('identification', val)
              if (val.trim().length === 10 || val.trim().length === 13) {
                const derivedCity = deriveEcuadorCityFromTaxId(val)
                if (derivedCity && !counterparty.city) {
                  onCounterpartyChange('city', derivedCity)
                }
              }
            }}
            placeholder={consumidorFinal ? '9999999999999' : 'Cédula (10d) o RUC (13d)'}
            disabled={disabled || consumidorFinal}
            fullWidth
          />
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--name">
          <TextBox
            id="inv-name"
            label="Razón Social / Nombres del Comprador"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.businessName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('businessName', e.target.value)
            }
            placeholder={consumidorFinal ? 'CONSUMIDOR FINAL' : 'Nombre o Razón Social'}
            disabled={disabled || consumidorFinal}
            fullWidth
          />
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--customer-type">
          <Select
            id="inv-customer-type"
            label="Tipo de cliente"
            labelPosition="outlined"
            variant="outline"
            options={[...CUSTOMER_TYPE_OPTIONS]}
            value={String(counterparty.customerType ?? 1)}
            onChange={(v) => emitParty('customerType', Number(v))}
            disabled={disabled || consumidorFinal}
            fullWidth
          />
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--email">
          <TextBox
            id="inv-email"
            label="Correo Electrónico (envío automático RIDE)"
            labelPosition="outlined"
            variant="outline"
            size="md"
            type="email"
            autoComplete="email"
            value={counterparty.email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('email', e.target.value)
            }
            placeholder="facturas@cliente.com"
            disabled={disabled}
            fullWidth
          />
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--phone">
          <TextBox
            id="inv-phone"
            label="Teléfono"
            labelPosition="outlined"
            variant="outline"
            size="md"
            type="tel"
            autoComplete="tel"
            value={counterparty.phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('phone', e.target.value)
            }
            placeholder="09xxxxxxxx"
            disabled={disabled}
            fullWidth
          />
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--payment">
          <Select
            id="inv-payment"
            label="Forma de Pago SRI"
            labelPosition="outlined"
            variant="outline"
            options={[...PAYMENT_FORM_OPTIONS]}
            value={paymentFormCode}
            onChange={emitPayment}
            disabled={disabled}
            fullWidth
          />
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--city">
          <TextBox
            id="inv-city"
            label="Ciudad"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.city}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('city', e.target.value)
            }
            placeholder="Quito, Guayaquil, etc."
            disabled={disabled}
            fullWidth
          />
        </div>

        <div className="factura-emitir__cell factura-emitir__cell--addr">
          <TextArea
            id="inv-addr"
            label="Dirección de Facturación"
            labelPosition="outlined"
            variant="outline"
            rows={2}
            value={counterparty.address}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              emitParty('address', e.target.value)
            }
            placeholder="Av. Principal, calle secundaria y referencia de ubicación..."
            disabled={disabled}
            fullWidth
          />
        </div>
      </div>

      {consumidorFinal ? (
        <p className="factura-emitir__meta-hint" role="note">
          Consumidor final: ID <code>9999999999999</code>, razón social fija y total ≤ USD{' '}
          {CONSUMIDOR_FINAL_MAX_TOTAL_USD} (SRI).
        </p>
      ) : (
        <p className="factura-emitir__meta-hint">
          Al ingresar la Cédula (10d) o RUC (13d) los datos de Ecuador y la provincia/ciudad se autodetectan automáticamente.
        </p>
      )}
    </section>
  )
}
