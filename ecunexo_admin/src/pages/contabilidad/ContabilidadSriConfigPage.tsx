import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button, useToast } from 'glubox'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { parseRimpeKind } from '@/features/organization/rimpeKind'
import { useHasPermission } from '@/hooks/useHasPermission'
import {
  getBillingEmitProfile,
  readBillingEmitProfile,
  storeBillingEmitProfile,
} from '@/lib/billingEmitProfile'
import {
  normalizeEmissionPoint,
  normalizeSequentialInput,
  readBillingEmissionPoint,
  storeBillingEmissionPoint,
} from '@/lib/billingSriEmission'
import { readApiError } from '@/lib/readApiError'
import { SriConfigAside } from '@/pages/contabilidad/SriConfigAside'
import {
  SriEmissionFields,
  SriIdentityCard,
  type SriEmissionValues,
  type SriLegalInfoValues,
} from '@/pages/contabilidad/SriLegalInfoSection'
import { SriSoftwareProviderSection } from '@/pages/contabilidad/SriSoftwareProviderSection'
import {
  SriSignatureSection,
  type SriSignatureValues,
} from '@/pages/contabilidad/SriSignatureSection'
import { ensureBillingEmitter, sriTradeName } from '@/pages/facturacion/invoiceEmitApi'
import { normalizeEstablishmentCode } from '@/pages/facturacion/invoiceFormTypes'
import { updateSubscriptionCompany } from '@/services/companiesApi'
import { peekNextSequential, setNextSequential } from '@/services/billingApi'
import { getTenant } from '@/services/tenantApi'
import {
  selectIsSubscriptionHolder,
  selectTenantBranding,
  selectTenantId,
} from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { UpdateSubscriptionCompanyBody } from '@/types/companiesApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'
import type { TenantBranding } from '@/types/tenantBranding'
import './sriConfig.css'

const INITIAL_LEGAL: SriLegalInfoValues = {
  ruc: '',
  razonSocial: '',
  nombreComercial: '',
  ciudad: '',
  establecimiento: '',
  puntoEmision: '001',
  secuencialSiguiente: '000000001',
  obligadoContabilidad: 'no',
  direccion: '',
  rimpe: 'none',
  exportador: 'no',
  granContribuyente: false,
  contribuyenteEspecial: false,
  agenteRetencion: false,
}

const INITIAL_SIGNATURE: SriSignatureValues = {
  password: '',
  expiresAt: '',
  autoSign: true,
  fileName: null,
  emitProfile: 'dev_sri',
}

function yesNo(value: boolean): string {
  return value ? 'si' : 'no'
}

function legalFromTenant(
  tenant: GetTenantByIdDto,
  emissionPoint: string,
  nextSequential: string
): SriLegalInfoValues {
  return {
    ruc: tenant.taxId ?? '',
    razonSocial: tenant.legalName?.trim() || tenant.name,
    nombreComercial: tenant.name,
    ciudad: tenant.city ?? '',
    establecimiento: tenant.establishmentCode ?? '',
    puntoEmision: emissionPoint,
    secuencialSiguiente: nextSequential,
    obligadoContabilidad: yesNo(tenant.accountingRequired),
    direccion: tenant.address ?? '',
    rimpe: tenant.rimpeKind ?? (tenant.isRimpe ? 'entrepreneur' : 'none'),
    exportador: yesNo(tenant.isExporter),
    granContribuyente: tenant.isLargeTaxpayer,
    contribuyenteEspecial: tenant.isSpecialTaxpayer,
    agenteRetencion: tenant.isWithholdingAgent,
  }
}

function legalFromBranding(branding: TenantBranding, tenantId: string | null): SriLegalInfoValues {
  return {
    ...INITIAL_LEGAL,
    razonSocial: branding.name?.trim() ?? '',
    nombreComercial: branding.name?.trim() ?? '',
    puntoEmision: readBillingEmissionPoint(tenantId),
  }
}

function computeProgress(legal: SriLegalInfoValues, sig: SriSignatureValues): number {
  const checks = [
    legal.ruc.trim().length >= 13,
    legal.razonSocial.trim().length > 0,
    legal.ciudad.trim().length > 0,
    legal.establecimiento.trim().length > 0,
    legal.puntoEmision.trim().length > 0,
    legal.secuencialSiguiente.trim().length > 0,
    legal.direccion.trim().length > 0,
    Boolean(sig.expiresAt),
    Boolean(sig.fileName),
    sig.password.trim().length > 0,
  ]
  const done = checks.filter(Boolean).length
  return Math.round((done / checks.length) * 100)
}

function buildCompanyUpdateBody(
  tenant: GetTenantByIdDto,
  legal: SriLegalInfoValues
): UpdateSubscriptionCompanyBody | string {
  const ruc = legal.ruc.trim()
  if (ruc && !/^\d{13}$/.test(ruc)) {
    return 'El RUC debe tener exactamente 13 dígitos.'
  }
  const rimpe = parseRimpeKind(legal.rimpe, legal.rimpe !== 'none')
  return {
    name: legal.nombreComercial.trim() || tenant.name,
    timeZoneId: tenant.timeZoneId ?? 'America/Guayaquil',
    locale: tenant.locale ?? 'es-EC',
    logoUrl: tenant.logoUrl ?? null,
    primaryColorHex: tenant.primaryColorHex ?? null,
    taxId: ruc || null,
    legalName: legal.razonSocial.trim() || null,
    city: legal.ciudad.trim() || null,
    establishmentCode: normalizeEstablishmentCode(legal.establecimiento) || null,
    address: legal.direccion.trim() || null,
    accountingRequired: legal.obligadoContabilidad === 'si',
    isRimpe: rimpe !== 'none',
    rimpeKind: rimpe,
    preferElectronicInvoice: tenant.preferElectronicInvoice,
    isExporter: legal.exportador === 'si',
    isLargeTaxpayer: legal.granContribuyente,
    isSpecialTaxpayer: legal.contribuyenteEspecial,
    isWithholdingAgent: legal.agenteRetencion,
    contactEmail: tenant.contactEmail ?? null,
    contactPhone: tenant.contactPhone ?? null,
    rideThankYouText: tenant.rideThankYouText ?? null,
  }
}

function pageTitle(pathname: string): string {
  if (pathname.includes('/organizacion/facturacion-electronica')) {
    return 'Facturación electrónica'
  }
  if (pathname.includes('/facturacion/emisor')) return 'Emisor'
  return 'Configuración SRI'
}

export function ContabilidadSriConfigPage() {
  const toast = useToast()
  const location = useLocation()
  const isCompanyPage = location.pathname.includes('/organizacion/facturacion-electronica')
  const canReadContabilidad = useHasPermission('contabilidad.configuracion.read')
  const canReadEmisor = useHasPermission('facturacion.emisor.read')
  const canReadTenant = useHasPermission('tenancy.tenant.read')
  const canRead = canReadContabilidad || canReadEmisor || canReadTenant || isCompanyPage
  const canUpdateTenant = useHasPermission('tenancy.tenant.update')
  const canUpdateCompanies = useHasPermission('tenancy.tenants.update')
  const isHolder = useAppSelector(selectIsSubscriptionHolder)
  const canUpdate = canUpdateTenant || canUpdateCompanies || isHolder
  const canPersistCompany = canUpdateCompanies || isHolder
  const tenantId = useAppSelector(selectTenantId)
  const branding = useAppSelector(selectTenantBranding)

  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [companyLabel, setCompanyLabel] = useState('')
  const [tenantSnapshot, setTenantSnapshot] = useState<GetTenantByIdDto | null>(null)
  const [legal, setLegal] = useState<SriLegalInfoValues>(() =>
    legalFromBranding(branding, tenantId)
  )
  const [signature, setSignature] = useState<SriSignatureValues>(INITIAL_SIGNATURE)

  const progress = useMemo(() => computeProgress(legal, signature), [legal, signature])
  const statusLabel = progress >= 100 ? 'Completo' : progress === 0 ? 'Sin iniciar' : 'Incompleto'
  const formDisabled = busy || loading || !canUpdate
  const title = pageTitle(location.pathname)

  const loadCompany = useCallback(async () => {
    if (!tenantId) {
      setLoadError('Entra a una empresa para configurar la facturación electrónica.')
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    try {
      const tenant = await getTenant(tenantId)
      const emissionPoint = readBillingEmissionPoint(tenantId)
      let nextSequential = '000000001'

      const ruc = tenant.taxId?.trim() ?? ''
      if (ruc.length >= 13) {
        try {
          const emitterId = await ensureBillingEmitter({
            emitterRuc: ruc,
            company: {
              legalName: tenant.legalName?.trim() || tenant.name,
              tradeName: sriTradeName(tenant.name, tenant.legalName),
              address: tenant.address?.trim() || '',
            },
            companyLabel: tenant.legalName?.trim() || tenant.name,
            tenantId,
          })
          const peeked = await peekNextSequential(emitterId, {
            establishment: normalizeEstablishmentCode(tenant.establishmentCode),
            emissionPoint,
          })
          nextSequential = peeked.nextSequential
        } catch (billingErr: unknown) {
          setLoadError(
            readApiError(
              billingErr,
              'No se pudo leer el secuencial en Billing. Al guardar se intentará de nuevo.'
            )
          )
        }
      }

      setLegal(legalFromTenant(tenant, emissionPoint, nextSequential))
      setTenantSnapshot(tenant)
      setCompanyLabel(tenant.legalName?.trim() || tenant.name)
      setSignature({
        ...INITIAL_SIGNATURE,
        emitProfile: readBillingEmitProfile(tenantId),
      })
    } catch (err: unknown) {
      setLegal(legalFromBranding(branding, tenantId))
      setTenantSnapshot(null)
      setCompanyLabel(branding.name)
      setLoadError(readApiError(err, 'No se pudieron cargar los datos de la empresa.'))
    } finally {
      setLoading(false)
    }
  }, [tenantId, branding])

  useEffect(() => {
    void loadCompany()
  }, [loadCompany])

  const patchLegal = useCallback(
    <K extends keyof SriLegalInfoValues>(key: K, value: SriLegalInfoValues[K]) => {
      setLegal((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const patchEmission = useCallback(
    <K extends keyof SriEmissionValues>(key: K, value: SriEmissionValues[K]) => {
      setLegal((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const patchSignature = useCallback(
    <K extends keyof SriSignatureValues>(key: K, value: SriSignatureValues[K]) => {
      setSignature((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const onSubmit = useCallback(async () => {
    if (!tenantId) {
      toast.show({
        title: title,
        message: 'No hay empresa seleccionada.',
        variant: 'error',
      })
      return
    }
    if (!tenantSnapshot) {
      toast.show({
        title: title,
        message: 'No hay ficha de empresa cargada. Recarga la página.',
        variant: 'error',
      })
      return
    }
    if (!canUpdate) {
      toast.show({
        title: 'Sin permiso',
        message: 'Necesitas permiso para guardar la configuración de la empresa.',
        variant: 'error',
      })
      return
    }

    const ruc = legal.ruc.trim()
    if (ruc.length < 13) {
      toast.show({
        title: 'RUC incompleto',
        message: 'Indica un RUC de 13 dígitos para sincronizar el emisor y el secuencial.',
        variant: 'error',
      })
      return
    }

    setBusy(true)
    try {
      const emissionPoint = normalizeEmissionPoint(legal.puntoEmision)
      const establishment = normalizeEstablishmentCode(legal.establecimiento)
      const nextSequential = normalizeSequentialInput(legal.secuencialSiguiente)
      storeBillingEmissionPoint(tenantId, emissionPoint)
      storeBillingEmitProfile(tenantId, signature.emitProfile)

      let companySynced = false
      if (canPersistCompany) {
        const body = buildCompanyUpdateBody(tenantSnapshot, legal)
        if (typeof body === 'string') {
          toast.show({ title: 'Datos incompletos', message: body, variant: 'error' })
          return
        }
        await updateSubscriptionCompany(tenantId, body)
        companySynced = true
      }

      const legalName = legal.razonSocial.trim() || tenantSnapshot.name
      const tradeName = legal.nombreComercial.trim() || legalName
      const address = legal.direccion.trim() || ''

      const emitterId = await ensureBillingEmitter({
        emitterRuc: ruc,
        company: {
          legalName,
          tradeName: sriTradeName(tradeName, legalName),
          address,
        },
        companyLabel: legalName,
        tenantId,
      })

      const savedSeq = await setNextSequential(emitterId, {
        nextSequential,
        establishment,
        emissionPoint,
        address: address || null,
      })

      const profile = getBillingEmitProfile(signature.emitProfile)
      toast.show({
        title: title,
        message: companySynced
          ? `Guardado en empresa y Billing. Próximo ${savedSeq.establishment}-${savedSeq.emissionPoint}-${savedSeq.nextSequential}. Modo: ${profile.label}.`
          : `Guardado en Billing (estab ${savedSeq.establishment}-${savedSeq.emissionPoint}-${savedSeq.nextSequential}). La ficha legal requiere titular (tenancy.tenants.update). Modo: ${profile.label}.`,
        variant: 'success',
      })
      await loadCompany()
    } catch (err: unknown) {
      toast.show({
        title: 'Error al guardar',
        message: readApiError(err, 'No se pudo guardar la configuración.'),
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [
    tenantId,
    tenantSnapshot,
    canUpdate,
    canPersistCompany,
    legal,
    signature.emitProfile,
    toast,
    loadCompany,
    title,
  ])

  if (!canRead) {
    return (
      <div className="sri-config-page">
        <h1 className="app-shell__page-title">{title}</h1>
        <p className="app-shell__page-lead">No tienes permiso para ver esta configuración.</p>
      </div>
    )
  }

  return (
    <div className="sri-config-page">
      <div>
        <h1 className="app-shell__page-title">{title}</h1>
        <p className="app-shell__page-lead">
          {companyLabel
            ? `Identidad, puntos de emisión y modo SRI — ${companyLabel}`
            : 'Configura la identidad legal, emisión y firma electrónica de la empresa.'}
        </p>
      </div>

      <PageLoadState
        loading={loading}
        error={loadError && !tenantId ? loadError : null}
        empty={!tenantId}
        emptyMessage="Entra a una empresa para configurar la facturación electrónica."
      >
        {loadError && tenantId ? (
          <p className="ecu-companies-form__hint" role="status">
            {loadError} Se muestran los datos de sesión disponibles.
          </p>
        ) : null}
        {!canUpdate ? (
          <p className="ecu-companies-form__hint" role="status">
            Solo lectura: falta permiso para guardar.
          </p>
        ) : null}
        {!canPersistCompany && canUpdate ? (
          <p className="ecu-companies-form__hint" role="note">
            Puedes ajustar emisión y secuencial en Billing. Para persistir RUC/razón social en la
            ficha, usa el titular en{' '}
            <Link to="/organizacion/empresas">listado de empresas</Link>.
          </p>
        ) : null}
        <p className="ecu-companies-form__hint" role="note">
          Firma electrónica de plataforma (Infisical) por ahora. Más adelante cada cliente tendrá su
          propio certificado. En modo pruebas el SRI puede recibir identidad EcuNexo aunque el PDF
          muestre datos del tenant.
        </p>
        <p className="ecu-companies-form__hint" role="note">
          El próximo secuencial es el de la siguiente factura. No rebobines por debajo del último ya
          usado en Billing / SRI.
        </p>

        <div className="sri-config-page__layout">
          <div className="sri-config-page__main ecu-companies-form">
            <SriIdentityCard
              values={legal}
              disabled={formDisabled || !canPersistCompany}
              onChange={canPersistCompany ? patchLegal : undefined}
            />
            <SriSoftwareProviderSection disabled={formDisabled} suggestedRuc={legal.ruc} />
            <form
              className="ecu-companies-form"
              onSubmit={(e) => {
                e.preventDefault()
                void onSubmit()
              }}
              noValidate
            >
              <SriEmissionFields
                values={{
                  establecimiento: legal.establecimiento,
                  puntoEmision: legal.puntoEmision,
                  secuencialSiguiente: legal.secuencialSiguiente,
                }}
                disabled={formDisabled}
                onChange={patchEmission}
              />
              <SriSignatureSection
                values={signature}
                disabled={formDisabled}
                onChange={patchSignature}
              />
              <footer className="ecu-companies-form__actions sri-config-page__actions">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={formDisabled}
                  loading={busy}
                >
                  {busy ? 'Guardando…' : 'Guardar configuración'}
                </Button>
              </footer>
            </form>
          </div>

          <SriConfigAside
            progressPercent={progress}
            statusLabel={statusLabel}
            emitProfileLabel={getBillingEmitProfile(signature.emitProfile).label}
            emitProfileIsDev={getBillingEmitProfile(signature.emitProfile).isDevelopment}
          />
        </div>
      </PageLoadState>
    </div>
  )
}
