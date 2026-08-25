/** Perfil de emisión electrónica configurado en Facturación → Emisor. */

export const BILLING_EMIT_PROFILES = [
  {
    value: 'dev_validate',
    label: 'Desarrollo — solo validar',
    shortLabel: 'Solo validar',
    description:
      'Genera el borrador y valida el XML contra el XSD. No firma ni envía al SRI. Ideal para revisar estructura.',
    isDevelopment: true,
    emitMode: 'draft',
    sriEnvironment: null,
  },
  {
    value: 'dev_sign',
    label: 'Desarrollo — solo firmar',
    shortLabel: 'Solo firmar',
    description:
      'Valida XSD y firma XAdES con el certificado (Infisical). No envía a recepción ni autorización del SRI.',
    isDevelopment: true,
    emitMode: 'sign',
    sriEnvironment: null,
  },
  {
    value: 'dev_sri',
    label: 'Desarrollo — SRI pruebas',
    shortLabel: 'SRI pruebas',
    description:
      'Firma y envía a los WS de pruebas del SRI (celcer). Los comprobantes no tienen validez tributaria.',
    isDevelopment: true,
    emitMode: 'sri',
    sriEnvironment: 'Test',
  },
  {
    value: 'production',
    label: 'Producción — SRI',
    shortLabel: 'Producción',
    description:
      'Firma y envía a los WS de producción del SRI (cel). Usar solo con RUC y certificado habilitados.',
    isDevelopment: false,
    emitMode: 'sri',
    sriEnvironment: 'Production',
  },
] as const

export type BillingEmitProfileId = (typeof BILLING_EMIT_PROFILES)[number]['value']

export type BillingEmitProfile = (typeof BILLING_EMIT_PROFILES)[number]

export type SriEnvironmentName = 'Test' | 'Production'

const STORAGE_PREFIX = 'ecunexo.billing.emitProfile.'

export function isBillingEmitProfileId(value: string): value is BillingEmitProfileId {
  return BILLING_EMIT_PROFILES.some((p) => p.value === value)
}

export function getBillingEmitProfile(id: BillingEmitProfileId): BillingEmitProfile {
  return BILLING_EMIT_PROFILES.find((p) => p.value === id) ?? BILLING_EMIT_PROFILES[0]
}

export function readBillingEmitProfile(tenantId: string | null): BillingEmitProfileId {
  if (!tenantId) return 'dev_validate'
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tenantId)
    if (raw && isBillingEmitProfileId(raw)) return raw
  } catch {
    // ignore
  }
  return 'dev_sri'
}

export function storeBillingEmitProfile(
  tenantId: string,
  profile: BillingEmitProfileId
): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + tenantId, profile)
  } catch {
    // ignore
  }
}
