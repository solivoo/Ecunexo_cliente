import { expect, test } from '@playwright/test'
import { parseAccessKey } from '../../src/pages/facturacion/sriAccessKey'

test.describe('Facturación SRI — Desglose Clave de Acceso y Diagnóstico Técnico', () => {
  test('parseAccessKey desglosa correctamente los 49 dígitos en posición 24 (ambiente) y secuencial', () => {
    // Clave de 49 dígitos de producción:
    // Fecha: 13092026, Doc: 01, RUC: 0993397804001, Amb: 2, Estab: 001, Pto: 001, Sec: 000000534, Num: 12345678, Emi: 1, DV: 9
    const prodKey = '1309202601099339780400120010010000005341234567819'
    expect(prodKey).toHaveLength(49)

    const parsed = parseAccessKey(prodKey)
    expect(parsed).not.toBeNull()
    expect(parsed?.date).toBe('13092026')
    expect(parsed?.docType).toBe('01')
    expect(parsed?.ruc).toBe('0993397804001')
    expect(parsed?.env).toBe('2') // Posición 24 (índice 23) = 2 (Producción)
    expect(parsed?.estab).toBe('001')
    expect(parsed?.ptoEmi).toBe('001')
    expect(parsed?.sequential).toBe('000000534')
    expect(parsed?.numericCode).toBe('12345678')
    expect(parsed?.emissionType).toBe('1')
    expect(parsed?.checkDigit).toBe('9')
  })

  test('parseAccessKey maneja claves de pruebas (Ambiente 1)', () => {
    const testKey = '1309202601092639807400110020250000000088470494816'
    expect(testKey).toHaveLength(49)

    const parsed = parseAccessKey(testKey)
    expect(parsed).not.toBeNull()
    expect(parsed?.env).toBe('1') // Posición 24 (índice 23) = 1 (Pruebas)
    expect(parsed?.sequential).toBe('000000008')
  })

  test('parseAccessKey retorna null si la clave es nula, vacía o no tiene 49 dígitos', () => {
    expect(parseAccessKey(null)).toBeNull()
    expect(parseAccessKey(undefined)).toBeNull()
    expect(parseAccessKey('')).toBeNull()
    expect(parseAccessKey('12345')).toBeNull()
    expect(parseAccessKey('13092026010926398074001100202500000000884704948161234')).toBeNull() // > 49
  })
})
