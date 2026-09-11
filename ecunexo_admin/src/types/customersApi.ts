export const CustomerType = {
  CorporativoB2B: 1,
  PersonaNatural: 2,
  DistribuidorMayorista: 3,
  TallerAliado: 4,
  ConsumidorFinal: 5,
  InstitucionPublica: 6,
} as const

export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType]

export type CustomerTypeTone = 'primary' | 'success' | 'warning' | 'neutral' | 'danger' | 'info'

export const CustomerIdentificationType = {
  Ruc: 1,
  Cedula: 2,
  Pasaporte: 3,
  ConsumidorFinal: 4,
} as const

export type CustomerIdentificationType = (typeof CustomerIdentificationType)[keyof typeof CustomerIdentificationType]

export interface CustomerTypeMeta {
  label: string
  shortLabel: string
  tone: CustomerTypeTone
  badgeColor?: string
  description: string
}

export const CUSTOMER_TYPE_METADATA: Record<CustomerType, CustomerTypeMeta> = {
  [CustomerType.CorporativoB2B]: {
    label: 'Corporativo B2B / Fabricante',
    shortLabel: 'Corporativo B2B',
    tone: 'primary',
    description: 'Empresas corporativas y marcas aliadas que contratan servicios a gran escala.',
  },
  [CustomerType.PersonaNatural]: {
    label: 'Persona Natural / Particular',
    shortLabel: 'Persona Natural',
    tone: 'success',
    description: 'Personas naturales, clientes finales y propietarios directos de equipos.',
  },
  [CustomerType.DistribuidorMayorista]: {
    label: 'Distribuidor / Mayorista',
    shortLabel: 'Distribuidor',
    tone: 'warning',
    description: 'Comercializadores mayoristas de productos, repuestos y equipos.',
  },
  [CustomerType.TallerAliado]: {
    label: 'Taller Técnico Aliado',
    shortLabel: 'Taller Aliado',
    tone: 'neutral',
    description: 'Talleres técnicos subcontratados o aliados en la red de soporte.',
  },
  [CustomerType.ConsumidorFinal]: {
    label: 'Consumidor Final',
    shortLabel: 'Consumidor Final',
    tone: 'neutral',
    description: 'Ventas y servicios directos por mostrador sin desglose fiscal.',
  },
  [CustomerType.InstitucionPublica]: {
    label: 'Institución Pública / Gobierno',
    shortLabel: 'Sector Público',
    tone: 'warning',
    description: 'Entidades gubernamentales, instituciones educativas y sector público.',
  },
}

export const CUSTOMER_IDENTIFICATION_LABELS: Record<CustomerIdentificationType, string> = {
  [CustomerIdentificationType.Ruc]: 'RUC (13 dígitos)',
  [CustomerIdentificationType.Cedula]: 'Cédula de Identidad (10 dígitos)',
  [CustomerIdentificationType.Pasaporte]: 'Pasaporte / Extranjero',
  [CustomerIdentificationType.ConsumidorFinal]: 'Consumidor Final (SRI)',
}

export type CustomerDto = {
  id: string
  tenantId?: string
  name: string
  taxId: string | null
  customerType: CustomerType
  identificationType: CustomerIdentificationType
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  contactPerson: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
}

export type CreateCustomerPayload = {
  name: string
  taxId?: string | null
  customerType: CustomerType
  identificationType: CustomerIdentificationType
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  contactPerson?: string | null
  notes?: string | null
  isActive?: boolean
}

export type UpdateCustomerPayload = {
  name: string
  taxId?: string | null
  customerType?: CustomerType
  identificationType?: CustomerIdentificationType
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  contactPerson?: string | null
  notes?: string | null
  isActive?: boolean
}

export type CustomerFilterParams = {
  type?: CustomerType
  search?: string
  from?: string
  to?: string
}

export type CustomerTypeDefinitionDto = {
  id: string
  code: number
  name: string
  shortLabel: string
  tone: string
  sortOrder: number
  isSystem: boolean
  isActive: boolean
}

export type CreateCustomerTypePayload = {
  name: string
  shortLabel: string
  tone?: string
  sortOrder?: number
}

export type UpdateCustomerTypePayload = {
  name: string
  shortLabel: string
  tone?: string
  sortOrder?: number
  isActive?: boolean
}

export type CustomerRepairRateCardDto = {
  id: string
  customerId: string
  rateN1: number | null
  rateN2: number | null
  rateN3: number | null
  contractReference: string | null
  validFrom: string | null
  createdAt: string
  updatedAt: string | null
}

export type UpsertCustomerRepairRateCardPayload = {
  rateN1?: number | null
  rateN2?: number | null
  rateN3?: number | null
  contractReference?: string | null
  validFrom?: string | null
}

export function resolveCustomerTypeMeta(
  code: number,
  definitions?: CustomerTypeDefinitionDto[]
): CustomerTypeMeta {
  const fromApi = definitions?.find((d) => d.code === code)
  if (fromApi) {
    return {
      label: fromApi.name,
      shortLabel: fromApi.shortLabel,
      tone: normalizeCustomerTypeTone(fromApi.tone),
      description: fromApi.isSystem ? 'Tipo de sistema' : 'Tipo personalizado',
    }
  }

  const fallback = CUSTOMER_TYPE_METADATA[code as CustomerType]
  if (fallback) return fallback

  return {
    label: `Tipo ${code}`,
    shortLabel: `Tipo ${code}`,
    tone: 'neutral',
    description: 'Clasificación comercial',
  }
}

export function normalizeCustomerTypeTone(tone: string): CustomerTypeTone {
  switch (tone) {
    case 'primary':
    case 'success':
    case 'warning':
    case 'neutral':
    case 'danger':
    case 'info':
      return tone
    default:
      return 'primary'
  }
}
