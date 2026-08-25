import { useCallback, useState } from 'react'
import type { CompanyBrandingValues } from '@/features/organization/components/CompanyBrandingFields'
import type { CompanyLegalValues } from '@/features/organization/components/CompanyLegalFields'
import type { CompanyRideValues } from '@/features/organization/companyFormOptions'
import { emptyToNull, isAccentColorValid } from '@/features/organization/companyFormOptions'
import { parseRimpeKind } from '@/features/organization/rimpeKind'
import type { UpdateSubscriptionCompanyBody } from '@/types/companiesApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'

function yesNo(value: boolean): string {
  return value ? 'si' : 'no'
}

export function useEditCompanyForm() {
  const [tenantName, setTenantName] = useState('')
  const [timeZoneId, setTimeZoneId] = useState('America/Guayaquil')
  const [locale, setLocale] = useState('es-EC')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColorHex, setPrimaryColorHex] = useState('#3B82F6')
  const [legalName, setLegalName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [city, setCity] = useState('')
  const [establishmentCode, setEstablishmentCode] = useState('')
  const [address, setAddress] = useState('')
  const [accountingRequired, setAccountingRequired] = useState('no')
  const [rimpeKind, setRimpeKind] = useState('none')
  const [preferElectronicInvoice, setPreferElectronicInvoice] = useState(false)
  const [isExporter, setIsExporter] = useState('no')
  const [isLargeTaxpayer, setIsLargeTaxpayer] = useState(false)
  const [isSpecialTaxpayer, setIsSpecialTaxpayer] = useState(false)
  const [isWithholdingAgent, setIsWithholdingAgent] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [rideThankYouText, setRideThankYouText] = useState('')

  const applyTenant = useCallback((tenant: GetTenantByIdDto) => {
    setTenantName(tenant.name)
    setTimeZoneId(tenant.timeZoneId ?? 'America/Guayaquil')
    setLocale(tenant.locale ?? 'es-EC')
    setLogoUrl(tenant.logoUrl ?? '')
    setPrimaryColorHex(tenant.primaryColorHex ?? '#3B82F6')
    setLegalName(tenant.legalName ?? '')
    setTaxId(tenant.taxId ?? '')
    setCity(tenant.city ?? '')
    setEstablishmentCode(tenant.establishmentCode ?? '')
    setAddress(tenant.address ?? '')
    setAccountingRequired(yesNo(tenant.accountingRequired))
    setRimpeKind(parseRimpeKind(tenant.rimpeKind, tenant.isRimpe))
    setPreferElectronicInvoice(Boolean(tenant.preferElectronicInvoice))
    setIsExporter(yesNo(tenant.isExporter))
    setIsLargeTaxpayer(tenant.isLargeTaxpayer)
    setIsSpecialTaxpayer(tenant.isSpecialTaxpayer)
    setIsWithholdingAgent(tenant.isWithholdingAgent)
    setContactEmail(tenant.contactEmail ?? '')
    setContactPhone(tenant.contactPhone ?? '')
    setRideThankYouText(tenant.rideThankYouText ?? '')
  }, [])

  const branding: CompanyBrandingValues = {
    tenantName,
    timeZoneId,
    locale,
    logoUrl,
    primaryColorHex,
  }

  const legal: CompanyLegalValues = {
    tradeName: tenantName,
    legalName,
    taxId,
    city,
    establishmentCode,
    address,
    accountingRequired,
    rimpeKind,
    preferElectronicInvoice,
    isExporter,
    isLargeTaxpayer,
    isSpecialTaxpayer,
    isWithholdingAgent,
  }

  const ride: CompanyRideValues = {
    contactEmail,
    contactPhone,
    rideThankYouText,
  }

  const patchBranding = useCallback(
    <K extends keyof CompanyBrandingValues>(key: K, value: CompanyBrandingValues[K]) => {
      if (key === 'tenantName') setTenantName(value)
      if (key === 'timeZoneId') setTimeZoneId(value)
      if (key === 'locale') setLocale(value)
      if (key === 'logoUrl') setLogoUrl(value)
      if (key === 'primaryColorHex') setPrimaryColorHex(value)
    },
    []
  )

  const patchLegal = useCallback(
    <K extends keyof CompanyLegalValues>(key: K, value: CompanyLegalValues[K]) => {
      if (key === 'tradeName') return
      if (key === 'legalName') setLegalName(value as string)
      if (key === 'taxId') setTaxId(value as string)
      if (key === 'city') setCity(value as string)
      if (key === 'establishmentCode') setEstablishmentCode(value as string)
      if (key === 'address') setAddress(value as string)
      if (key === 'accountingRequired') setAccountingRequired(value as string)
      if (key === 'rimpeKind') setRimpeKind(value as string)
      if (key === 'preferElectronicInvoice') setPreferElectronicInvoice(value as boolean)
      if (key === 'isExporter') setIsExporter(value as string)
      if (key === 'isLargeTaxpayer') setIsLargeTaxpayer(value as boolean)
      if (key === 'isSpecialTaxpayer') setIsSpecialTaxpayer(value as boolean)
      if (key === 'isWithholdingAgent') setIsWithholdingAgent(value as boolean)
    },
    []
  )

  const patchRide = useCallback(
    <K extends keyof CompanyRideValues>(key: K, value: CompanyRideValues[K]) => {
      if (key === 'contactEmail') setContactEmail(value)
      if (key === 'contactPhone') setContactPhone(value)
      if (key === 'rideThankYouText') setRideThankYouText(value)
    },
    []
  )

  const toBody = useCallback((): UpdateSubscriptionCompanyBody | string => {
    const name = tenantName.trim()
    if (!name) return 'El nombre de la empresa es obligatorio.'
    const color = primaryColorHex.trim()
    if (!isAccentColorValid(color)) return 'El color de acento debe ser #RGB o #RRGGBB.'
    const ruc = taxId.trim()
    if (ruc && !/^\d{13}$/.test(ruc)) return 'El RUC debe tener exactamente 13 dígitos.'

    return {
      name,
      timeZoneId: emptyToNull(timeZoneId) ?? 'America/Guayaquil',
      locale: emptyToNull(locale) ?? 'es-EC',
      logoUrl: emptyToNull(logoUrl),
      primaryColorHex: emptyToNull(color),
      taxId: emptyToNull(ruc),
      legalName: emptyToNull(legalName),
      city: emptyToNull(city),
      establishmentCode: emptyToNull(establishmentCode),
      address: emptyToNull(address),
      accountingRequired: accountingRequired === 'si',
      isRimpe: rimpeKind !== 'none',
      rimpeKind,
      preferElectronicInvoice: rimpeKind === 'popular-business' && preferElectronicInvoice,
      isExporter: isExporter === 'si',
      isLargeTaxpayer,
      isSpecialTaxpayer,
      isWithholdingAgent,
      contactEmail: emptyToNull(contactEmail),
      contactPhone: emptyToNull(contactPhone),
      rideThankYouText: emptyToNull(rideThankYouText),
    }
  }, [
    accountingRequired,
    address,
    city,
    contactEmail,
    contactPhone,
    establishmentCode,
    isExporter,
    isLargeTaxpayer,
    preferElectronicInvoice,
    rimpeKind,
    isSpecialTaxpayer,
    isWithholdingAgent,
    legalName,
    locale,
    logoUrl,
    primaryColorHex,
    rideThankYouText,
    taxId,
    tenantName,
    timeZoneId,
  ])

  return { applyTenant, branding, legal, ride, patchBranding, patchLegal, patchRide, toBody }
}
