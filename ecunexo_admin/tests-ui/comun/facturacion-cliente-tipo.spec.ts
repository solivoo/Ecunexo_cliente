import { expect, test } from '@playwright/test'
import {
  CUSTOMER_TYPE_OPTIONS,
  applyCounterpartyIdType,
  defaultCustomerTypeForSriId,
  sriTypeToCustomerIdentificationType,
  type InvoiceCounterpartyValues,
} from '../../src/pages/facturacion/invoiceFormTypes'

test.describe('Facturación — Tipo de Cliente y Auto-Aprovisionamiento en Directorio', () => {
  test('defaultCustomerTypeForSriId asigna tipos de cliente acordes al SRI', () => {
    // RUC (04) e Identificación Exterior (08) -> Corporativo B2B (1)
    expect(defaultCustomerTypeForSriId('04')).toBe(1)
    expect(defaultCustomerTypeForSriId('08')).toBe(1)

    // Cédula (05) y Pasaporte (06) -> Persona Natural (2)
    expect(defaultCustomerTypeForSriId('05')).toBe(2)
    expect(defaultCustomerTypeForSriId('06')).toBe(2)

    // Consumidor Final (07) -> Consumidor Final (5)
    expect(defaultCustomerTypeForSriId('07')).toBe(5)
  })

  test('sriTypeToCustomerIdentificationType mapea SRI a enum de CustomerIdentificationType', () => {
    expect(sriTypeToCustomerIdentificationType('04')).toBe(1) // Ruc
    expect(sriTypeToCustomerIdentificationType('05')).toBe(2) // Cedula
    expect(sriTypeToCustomerIdentificationType('06')).toBe(3) // Pasaporte
    expect(sriTypeToCustomerIdentificationType('08')).toBe(3) // Exterior / Pasaporte
    expect(sriTypeToCustomerIdentificationType('07')).toBe(4) // ConsumidorFinal
  })

  test('CUSTOMER_TYPE_OPTIONS contiene los tipos de cliente requeridos', () => {
    const values = CUSTOMER_TYPE_OPTIONS.map((opt) => opt.value)
    expect(values).toContain('1') // Corporativo B2B
    expect(values).toContain('2') // Persona Natural
    expect(values).toContain('3') // Distribuidor Mayorista
    expect(values).toContain('4') // Taller Aliado
    expect(values).toContain('5') // Consumidor Final
    expect(values).toContain('6') // Institución Pública
  })

  test('applyCounterpartyIdType preconfigura datos al cambiar a Consumidor Final (07)', () => {
    const prev: InvoiceCounterpartyValues = {
      identificationType: '04',
      identification: '0993397804001',
      businessName: 'EMPRESA EJEMPLO S.A.',
      customerType: 1,
      address: 'Guayaquil',
      email: 'info@ejemplo.com',
      phone: '0991234567',
    }

    const updated = applyCounterpartyIdType(prev, '07')

    expect(updated.identificationType).toBe('07')
    expect(updated.identification).toBe('9999999999999')
    expect(updated.businessName).toBe('CONSUMIDOR FINAL')
    expect(updated.customerType).toBe(5)
  })

  test('applyCounterpartyIdType asigna customerType 2 al cambiar a Cédula (05)', () => {
    const prev: InvoiceCounterpartyValues = {
      identificationType: '07',
      identification: '9999999999999',
      businessName: 'CONSUMIDOR FINAL',
      customerType: 5,
      address: '',
      email: '',
      phone: '',
    }

    const updated = applyCounterpartyIdType(prev, '05')

    expect(updated.identificationType).toBe('05')
    expect(updated.identification).toBe('')
    expect(updated.businessName).toBe('')
    expect(updated.customerType).toBe(2)
  })
})
