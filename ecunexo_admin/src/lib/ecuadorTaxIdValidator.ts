/**
 * Validador oficial de Identificaciones Tributarias del Ecuador (SRI / Registro Civil)
 * Soporta:
 * - Cédula de Identidad (10 dígitos, Módulo 10)
 * - RUC Persona Natural (13 dígitos, Cédula + establecimiento)
 * - RUC Sociedad Privada / Extranjeros (13 dígitos, tercer dígito 9, Módulo 11)
 * - RUC Sociedad Pública (13 dígitos, tercer dígito 6, Módulo 11)
 * - Consumidor Final (9999999999999)
 * - Pasaporte / Identificación Extranjera
 */

export type DocumentTypeOption = 'AUTO' | 'RUC' | 'CEDULA' | 'PASAPORTE' | 'CONSUMIDOR_FINAL'

export type TaxIdCategory =
  | 'cedula'
  | 'ruc_natural'
  | 'ruc_sociedad_privada'
  | 'ruc_sociedad_publica'
  | 'consumidor_final'
  | 'pasaporte'
  | 'invalido'

export interface TaxIdValidationResult {
  readonly isValid: boolean
  readonly category: TaxIdCategory
  readonly label: string
  readonly error?: string
}

const PROVINCE_CODES = new Set<number>([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 30, // 30: Ecuatorianos registrados en el exterior
])

/**
 * Valida Cédula de Identidad ecuatoriana (10 dígitos)
 */
export function validateCedula(cedula: string): { isValid: boolean; error?: string } {
  const clean = cedula.trim()
  if (!/^\d{10}$/.test(clean)) {
    return { isValid: false, error: 'La cédula debe contener exactamente 10 dígitos numéricos.' }
  }

  const province = parseInt(clean.substring(0, 2), 10)
  if (!PROVINCE_CODES.has(province)) {
    return { isValid: false, error: `Código de provincia inválido (${clean.substring(0, 2)}). Debe estar entre 01-24 o 30.` }
  }

  const thirdDigit = parseInt(clean[2], 10)
  if (thirdDigit >= 6) {
    return { isValid: false, error: 'El tercer dígito de una cédula debe ser menor a 6.' }
  }

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let sum = 0
  for (let i = 0; i < 9; i++) {
    let val = parseInt(clean[i], 10) * coefficients[i]
    if (val >= 10) {
      val -= 9
    }
    sum += val
  }

  const remainder = sum % 10
  const checkDigit = remainder === 0 ? 0 : 10 - remainder
  const expectedCheckDigit = parseInt(clean[9], 10)

  if (checkDigit !== expectedCheckDigit) {
    return { isValid: false, error: `Dígito verificador inválido para cédula (esperado: ${checkDigit}, ingresado: ${expectedCheckDigit}).` }
  }

  return { isValid: true }
}

/**
 * Valida RUC de Sociedad Privada / Extranjera (13 dígitos, 3er dígito 9, Módulo 11)
 */
function validateRucSociedadPrivada(ruc: string): { isValid: boolean; error?: string } {
  const province = parseInt(ruc.substring(0, 2), 10)
  if (!PROVINCE_CODES.has(province)) {
    return { isValid: false, error: `Código de provincia inválido (${ruc.substring(0, 2)}).` }
  }

  if (ruc.substring(10, 13) === '000') {
    return { isValid: false, error: 'El código de establecimiento no puede ser 000.' }
  }

  const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(ruc[i], 10) * coefficients[i]
  }

  const remainder = sum % 11
  const checkDigit = remainder === 0 ? 0 : 11 - remainder

  if (checkDigit === 10) {
    return { isValid: false, error: 'RUC con dígito verificador 10 no es válido.' }
  }

  const expectedCheckDigit = parseInt(ruc[9], 10)
  if (checkDigit !== expectedCheckDigit) {
    return { isValid: false, error: `Dígito verificador de RUC privado inválido (esperado: ${checkDigit}, ingresado: ${expectedCheckDigit}).` }
  }

  return { isValid: true }
}

/**
 * Valida RUC de Sociedad Pública (13 dígitos, 3er dígito 6, Módulo 11)
 */
function validateRucSociedadPublica(ruc: string): { isValid: boolean; error?: string } {
  const province = parseInt(ruc.substring(0, 2), 10)
  if (!PROVINCE_CODES.has(province)) {
    return { isValid: false, error: `Código de provincia inválido (${ruc.substring(0, 2)}).` }
  }

  if (ruc.substring(9, 13) === '0000') {
    return { isValid: false, error: 'El código de establecimiento público no puede ser 0000.' }
  }

  const coefficients = [3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 8; i++) {
    sum += parseInt(ruc[i], 10) * coefficients[i]
  }

  const remainder = sum % 11
  const checkDigit = remainder === 0 ? 0 : 11 - remainder

  if (checkDigit === 10) {
    return { isValid: false, error: 'RUC público con dígito verificador 10 no es válido.' }
  }

  const expectedCheckDigit = parseInt(ruc[8], 10)
  if (checkDigit !== expectedCheckDigit) {
    return { isValid: false, error: `Dígito verificador de RUC público inválido (esperado: ${checkDigit}, ingresado: ${expectedCheckDigit}).` }
  }

  return { isValid: true }
}

/**
 * Valida RUC Persona Natural (13 dígitos: Cédula válida + establecimiento > 000)
 */
function validateRucPersonaNatural(ruc: string): { isValid: boolean; error?: string } {
  const cedulaPart = ruc.substring(0, 10)
  const cedulaValidation = validateCedula(cedulaPart)
  if (!cedulaValidation.isValid) {
    return { isValid: false, error: `Los primeros 10 dígitos no forman una cédula válida: ${cedulaValidation.error}` }
  }

  const establishment = ruc.substring(10, 13)
  if (establishment === '000') {
    return { isValid: false, error: 'El código de establecimiento no puede ser 000.' }
  }

  return { isValid: true }
}

/**
 * Valida identificación de forma inteligente según formato o tipo solicitado
 */
export function validateEcuadorTaxId(
  input: string,
  preferredType: DocumentTypeOption = 'AUTO'
): TaxIdValidationResult {
  const clean = input.trim().toUpperCase()

  if (!clean) {
    return {
      isValid: false,
      category: 'invalido',
      label: 'Sin identificación',
      error: 'La identificación no puede estar vacía.',
    }
  }

  // Consumidor Final
  if (clean === '9999999999999') {
    return {
      isValid: true,
      category: 'consumidor_final',
      label: 'Consumidor Final (SRI 9999999999999)',
    }
  }

  // Si se fuerza tipo Pasaporte
  if (preferredType === 'PASAPORTE') {
    if (/^[A-Z0-9\-_]{3,20}$/.test(clean)) {
      return {
        isValid: true,
        category: 'pasaporte',
        label: 'Pasaporte / Identificación Extranjera',
      }
    }
    return {
      isValid: false,
      category: 'invalido',
      label: 'Pasaporte inválido',
      error: 'El pasaporte debe tener entre 3 y 20 caracteres alfanuméricos.',
    }
  }

  // Cédula: exactamente 10 dígitos numéricos
  if (/^\d{10}$/.test(clean)) {
    if (preferredType === 'RUC') {
      return {
        isValid: false,
        category: 'invalido',
        label: 'RUC incompleto',
        error: 'El RUC requiere 13 dígitos numéricos (se ingresaron 10 de cédula).',
      }
    }
    const res = validateCedula(clean)
    return {
      isValid: res.isValid,
      category: res.isValid ? 'cedula' : 'invalido',
      label: res.isValid ? 'Cédula de Identidad (Válida)' : 'Cédula de Identidad inválida',
      error: res.error,
    }
  }

  // RUC: exactamente 13 dígitos numéricos
  if (/^\d{13}$/.test(clean)) {
    if (preferredType === 'CEDULA') {
      return {
        isValid: false,
        category: 'invalido',
        label: 'Cédula excedida',
        error: 'La cédula debe tener exactamente 10 dígitos (se ingresaron 13).',
      }
    }

    const thirdDigit = parseInt(clean[2], 10)

    if (thirdDigit < 6) {
      const res = validateRucPersonaNatural(clean)
      return {
        isValid: res.isValid,
        category: res.isValid ? 'ruc_natural' : 'invalido',
        label: res.isValid ? 'RUC Persona Natural (Válido)' : 'RUC Persona Natural inválido',
        error: res.error,
      }
    } else if (thirdDigit === 9) {
      const res = validateRucSociedadPrivada(clean)
      return {
        isValid: res.isValid,
        category: res.isValid ? 'ruc_sociedad_privada' : 'invalido',
        label: res.isValid ? 'RUC Sociedad Privada (Válido)' : 'RUC Sociedad Privada inválido',
        error: res.error,
      }
    } else if (thirdDigit === 6) {
      const res = validateRucSociedadPublica(clean)
      return {
        isValid: res.isValid,
        category: res.isValid ? 'ruc_sociedad_publica' : 'invalido',
        label: res.isValid ? 'RUC Entidad Pública (Válido)' : 'RUC Entidad Pública inválido',
        error: res.error,
      }
    } else {
      return {
        isValid: false,
        category: 'invalido',
        label: 'RUC inválido',
        error: `Tercer dígito (${thirdDigit}) no corresponde a persona natural (<6), sociedad privada (9) ni entidad pública (6).`,
      }
    }
  }

  // Si no son 10 o 13 dígitos, y contiene letras o guiones, verificar si puede ser pasaporte
  if (/^[A-Z0-9\-_]{3,20}$/.test(clean)) {
    if (preferredType === 'RUC' || preferredType === 'CEDULA') {
      return {
        isValid: false,
        category: 'invalido',
        label: 'Formato inválido',
        error: `El formato seleccionado (${preferredType}) requiere dígitos numéricos.`,
      }
    }
    if (/^\d+$/.test(clean) && preferredType === 'AUTO') {
      return {
        isValid: false,
        category: 'invalido',
        label: 'Identificación numérica incompleta',
        error: 'La identificación debe ser Cédula (10 dígitos) o RUC (13 dígitos).',
      }
    }
    return {
      isValid: true,
      category: 'pasaporte',
      label: 'Pasaporte / Identificación Extranjera',
    }
  }

  return {
    isValid: false,
    category: 'invalido',
    label: 'Identificación no válida',
    error: 'La identificación debe ser Cédula (10 dígitos), RUC (13 dígitos) o Pasaporte válido (3-20 caracteres).',
  }
}

/**
 * Validador de Email
 */
export function validateEmail(email: string | null | undefined): { isValid: boolean; error?: string } {
  if (!email || !email.trim()) return { isValid: true }
  const trimmed = email.trim()
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!re.test(trimmed)) {
    return {
      isValid: false,
      error: 'Formato de correo electrónico inválido (ejemplo: contacto@empresa.com).',
    }
  }
  return { isValid: true }
}

/**
 * Validador de Teléfono (Celular / Fijo Ecuador o Internacional)
 */
export function validatePhone(phone: string | null | undefined): { isValid: boolean; error?: string } {
  if (!phone || !phone.trim()) return { isValid: true }
  const clean = phone.trim().replace(/[\s\-().]/g, '')

  // Celular Ecuador: 09xxxxxxxx (10 dígitos)
  if (/^09\d{8}$/.test(clean)) return { isValid: true }

  // Fijo Ecuador: 0[2-7]xxxxxxx (9 dígitos)
  if (/^0[2-7]\d{7}$/.test(clean)) return { isValid: true }

  // Formato internacional: +593... o 7 a 15 dígitos
  if (/^\+?[0-9]{7,15}$/.test(clean)) return { isValid: true }

  return {
    isValid: false,
    error: 'Teléfono inválido. Ingrese 10 dígitos para celular (09...), 9 para fijo (02...) o formato internacional (+593...).',
  }
}
