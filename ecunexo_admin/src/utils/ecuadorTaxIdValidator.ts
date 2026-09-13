/**
 * Validador oficial de identificaciones tributarias en Ecuador (SRI):
 * - Cédula de Identidad (10 dígitos, Módulo 10).
 * - RUC Persona Natural (10 dígitos de cédula + 001..999).
 * - RUC Sociedad Privada (13 dígitos, 3er dígito = 9, Módulo 11).
 * - RUC Sociedad Pública (13 dígitos, 3er dígito = 6, Módulo 11).
 * - Pasaporte (3 a 20 caracteres alfanuméricos).
 */

export interface TaxIdValidationResult {
  isValid: boolean
  error?: string
  identificationType?: 'cedula' | 'ruc_natural' | 'ruc_privada' | 'ruc_publica' | 'pasaporte'
}

export function validateCedula(cedula: string): TaxIdValidationResult {
  const digits = cedula.trim()
  if (!/^\d{10}$/.test(digits)) {
    return { isValid: false, error: 'La cédula debe contener exactamente 10 dígitos numéricos.' }
  }

  const province = parseInt(digits.substring(0, 2), 10)
  if ((province < 1 || province > 24) && province !== 30) {
    return { isValid: false, error: 'El código de provincia (dos primeros dígitos) no es válido para Ecuador.' }
  }

  const thirdDigit = parseInt(digits.substring(2, 3), 10)
  if (thirdDigit >= 6) {
    return { isValid: false, error: 'El tercer dígito de una cédula de persona natural debe ser menor a 6.' }
  }

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let sum = 0
  for (let i = 0; i < 9; i++) {
    let val = parseInt(digits[i], 10) * coefficients[i]
    if (val >= 10) {
      val -= 9
    }
    sum += val
  }

  const remainder = sum % 10
  const expectedCheckDigit = remainder === 0 ? 0 : 10 - remainder
  const actualCheckDigit = parseInt(digits[9], 10)

  if (expectedCheckDigit !== actualCheckDigit) {
    return { isValid: false, error: 'El dígito verificador de la cédula no coincide con el algoritmo Módulo 10 del SRI.' }
  }

  return { isValid: true, identificationType: 'cedula' }
}

export function validateRuc(ruc: string): TaxIdValidationResult {
  const digits = ruc.trim()
  if (!/^\d{13}$/.test(digits)) {
    return { isValid: false, error: 'El RUC debe contener exactamente 13 dígitos numéricos.' }
  }

  const province = parseInt(digits.substring(0, 2), 10)
  if ((province < 1 || province > 24) && province !== 30) {
    return { isValid: false, error: 'El código de provincia (dos primeros dígitos) no es válido para Ecuador.' }
  }

  const thirdDigit = parseInt(digits.substring(2, 3), 10)

  // 1. RUC Persona Natural (tercer dígito < 6)
  if (thirdDigit < 6) {
    const establishment = digits.substring(10, 13)
    if (establishment === '000') {
      return { isValid: false, error: 'El código de establecimiento del RUC de persona natural no puede ser 000.' }
    }

    const cedulaCheck = validateCedula(digits.substring(0, 10))
    if (!cedulaCheck.isValid) {
      return { isValid: false, error: `Los primeros 10 dígitos no forman una cédula válida: ${cedulaCheck.error}` }
    }

    return { isValid: true, identificationType: 'ruc_natural' }
  }

  // 2. RUC Sociedad Pública (tercer dígito = 6)
  if (thirdDigit === 6) {
    const establishment = digits.substring(9, 13)
    if (establishment === '0000') {
      return { isValid: false, error: 'El código de establecimiento del RUC de entidad pública no puede ser 0000.' }
    }

    const coefficients = [3, 2, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < 8; i++) {
      sum += parseInt(digits[i], 10) * coefficients[i]
    }

    const remainder = sum % 11
    const expectedCheckDigit = remainder === 0 ? 0 : 11 - remainder
    const actualCheckDigit = parseInt(digits[8], 10)

    if (expectedCheckDigit !== actualCheckDigit) {
      return { isValid: false, error: 'El dígito verificador del RUC de institución pública no es válido (Módulo 11).' }
    }

    return { isValid: true, identificationType: 'ruc_publica' }
  }

  // 3. RUC Sociedad Privada (tercer dígito = 9)
  if (thirdDigit === 9) {
    const establishment = digits.substring(10, 13)
    if (establishment === '000') {
      return { isValid: false, error: 'El código de establecimiento del RUC de sociedad no puede ser 000.' }
    }

    const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits[i], 10) * coefficients[i]
    }

    const remainder = sum % 11
    const expectedCheckDigit = remainder === 0 ? 0 : 11 - remainder
    const actualCheckDigit = parseInt(digits[9], 10)

    if (expectedCheckDigit !== actualCheckDigit) {
      return { isValid: false, error: 'El dígito verificador del RUC de sociedad privada no es válido (Módulo 11).' }
    }

    return { isValid: true, identificationType: 'ruc_privada' }
  }

  return { isValid: false, error: 'El tercer dígito del RUC debe ser menor a 6 (natural), 6 (pública) o 9 (sociedad privada).' }
}

export function validatePassport(passport: string): TaxIdValidationResult {
  const trimmed = passport.trim()
  if (trimmed.length < 3 || trimmed.length > 20) {
    return { isValid: false, error: 'El pasaporte debe tener entre 3 y 20 caracteres.' }
  }

  if (!/^[a-zA-Z0-9\-]+$/.test(trimmed)) {
    return { isValid: false, error: 'El pasaporte solo puede contener letras, números o guiones.' }
  }

  return { isValid: true, identificationType: 'pasaporte' }
}

export function validateTaxId(taxId: string, identificationType: 'ruc' | 'cedula' | 'pasaporte'): TaxIdValidationResult {
  if (!taxId || !taxId.trim()) {
    return { isValid: false, error: 'El número de identificación es obligatorio.' }
  }

  const clean = taxId.trim()
  if (identificationType === 'ruc') {
    return validateRuc(clean)
  }
  if (identificationType === 'cedula') {
    return validateCedula(clean)
  }
  return validatePassport(clean)
}
