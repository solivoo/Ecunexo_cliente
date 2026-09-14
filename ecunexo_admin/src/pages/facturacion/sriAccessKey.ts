/**
 * Utilidades para la clave de acceso de 49 dígitos del SRI Ecuador.
 *
 * Fórmula oficial SRI:
 * [Fecha (8)] + [Tipo Doc (2)] + [RUC (13)] + [Ambiente (1)] +
 * [Estab (3)] + [PtoEmi (3)] + [Secuencial (9)] + [Código Numérico (8)] +
 * [Tipo Emisión (1)] + [Dígito Verificador Módulo 11 (1)]
 */

export type AccessKeyBreakdown = {
  readonly raw: string
  readonly date: string
  readonly docType: string
  readonly ruc: string
  readonly env: string
  readonly estab: string
  readonly ptoEmi: string
  readonly sequential: string
  readonly numericCode: string
  readonly emissionType: string
  readonly checkDigit: string
}

export function parseAccessKey(key: string | null | undefined): AccessKeyBreakdown | null {
  if (!key || key.length !== 49) return null
  return {
    raw: key,
    date: key.slice(0, 8),
    docType: key.slice(8, 10),
    ruc: key.slice(10, 23),
    env: key.charAt(23),
    estab: key.slice(24, 27),
    ptoEmi: key.slice(27, 30),
    sequential: key.slice(30, 39),
    numericCode: key.slice(39, 47),
    emissionType: key.charAt(47),
    checkDigit: key.charAt(48),
  }
}
