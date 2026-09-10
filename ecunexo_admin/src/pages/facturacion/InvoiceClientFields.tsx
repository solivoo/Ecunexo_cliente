import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Select, TextBox } from 'glubox'
import {
  CONSUMIDOR_FINAL_MAX_TOTAL_USD,
  ID_TYPE_OPTIONS,
  PAYMENT_FORM_OPTIONS,
  customerIdentificationToSriType,
  isConsumidorFinalType,
  type InvoiceCounterpartyValues,
} from '@/pages/facturacion/invoiceFormTypes'
import { listCustomers } from '@/services/customersApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CustomerDto } from '@/types/customersApi'

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
      address: customer.address ?? '',
      email: customer.contactEmail ?? '',
      phone: customer.contactPhone ?? '',
    }
  }

  return {
    ...paymentKept,
    identificationType,
    identification: customer.taxId?.trim() ?? '',
    businessName: customer.name,
    address: customer.address ?? '',
    email: customer.contactEmail ?? '',
    phone: customer.contactPhone ?? '',
  }
}

/** Cliente + forma de pago en grilla de 4 columnas alineadas. */
export function InvoiceClientFields({
  counterparty,
  paymentFormCode,
  disabled = false,
  onCounterpartyChange,
  onCounterpartyReplace,
  onPaymentFormChange,
}: InvoiceClientFieldsProps) {
  const tenantId = useAppSelector(selectTenantId)
  const [directory, setDirectory] = useState<CustomerDto[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [directoryError, setDirectoryError] = useState<string | null>(null)

  const consumidorFinal = isConsumidorFinalType(counterparty.identificationType)
  const emitParty: InvoiceClientFieldsProps['onCounterpartyChange'] = (key, value) => {
    if (disabled) return
    if (consumidorFinal && (key === 'identification' || key === 'businessName')) return
    setSelectedCustomerId('')
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
      { value: '', label: 'Seleccionar del directorio comercial…' },
      ...directory.map((c) => ({
        value: c.id,
        label: `${c.name}${c.taxId ? ` · ${c.taxId}` : ''}`,
      })),
    ],
    [directory]
  )

  const handleDirectorySelect = (customerId: string) => {
    setSelectedCustomerId(customerId)
    if (!customerId || disabled) return
    const customer = directory.find((c) => c.id === customerId)
    if (!customer) return
    const next = customerToCounterparty(customer, counterparty)
    if (onCounterpartyReplace) {
      onCounterpartyReplace(next)
      return
    }
    onCounterpartyChange('identificationType', next.identificationType)
    onCounterpartyChange('identification', next.identification)
    onCounterpartyChange('businessName', next.businessName)
    onCounterpartyChange('address', next.address)
    onCounterpartyChange('email', next.email)
    onCounterpartyChange('phone', next.phone)
  }

  return (
    <section className="factura-emitir__meta-block">
      <header className="factura-emitir__meta-head">
        <h2 className="factura-emitir__meta-label">Cliente</h2>
      </header>

      <div className="factura-emitir__meta-grid factura-emitir__meta-grid--client">
        <div className="factura-emitir__cell factura-emitir__cell--directory">
          <Select
            id="inv-directory-customer"
            label="Directorio comercial"
            labelPosition="outlined"
            variant="outline"
            options={directoryOptions}
            value={selectedCustomerId}
            onChange={handleDirectorySelect}
            disabled={disabled || directory.length === 0}
            fullWidth
          />
          {directoryError ? (
            <p className="factura-emitir__meta-hint" role="alert">
              {directoryError}
            </p>
          ) : (
            <p className="factura-emitir__meta-hint">
              Elige un cliente habilitado para rellenar RUC, razón social y contacto. Puedes ajustar
              los campos después.
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
            label="Identificación"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.identification}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('identification', e.target.value)
            }
            placeholder={consumidorFinal ? '9999999999999' : 'RUC / cédula'}
            disabled={disabled || consumidorFinal}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--name">
          <TextBox
            id="inv-name"
            label="Razón social"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.businessName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('businessName', e.target.value)
            }
            placeholder={consumidorFinal ? 'CONSUMIDOR FINAL' : 'Nombre del comprador'}
            disabled={disabled || consumidorFinal}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--payment">
          <Select
            id="inv-payment"
            label="Forma de pago"
            labelPosition="outlined"
            variant="outline"
            options={[...PAYMENT_FORM_OPTIONS]}
            value={paymentFormCode}
            onChange={emitPayment}
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--addr">
          <TextBox
            id="inv-addr"
            label="Dirección"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.address}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('address', e.target.value)
            }
            placeholder="Opcional"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--email">
          <TextBox
            id="inv-email"
            label="Correo"
            labelPosition="outlined"
            variant="outline"
            size="md"
            type="email"
            autoComplete="email"
            value={counterparty.email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('email', e.target.value)
            }
            placeholder="factura@cliente.com"
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
      </div>

      {consumidorFinal ? (
        <p className="factura-emitir__meta-hint" role="note">
          Consumidor final: ID <code>9999999999999</code>, razón social fija y total ≤ USD{' '}
          {CONSUMIDOR_FINAL_MAX_TOTAL_USD} (SRI).
        </p>
      ) : (
        <p className="factura-emitir__meta-hint">
          El correo se usará para enviar el comprobante electrónico.
        </p>
      )}
    </section>
  )
}
