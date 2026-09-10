import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button, useToast } from 'glubox'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
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
    preferElectronicInvoice: Boolean(tenant.preferElectronicInvoice),
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
    return 'Facturación Electrónica'
  }
  if (pathname.includes('/facturacion/emisor')) return 'Emisor'
  return 'Configuración SRI'
}

export function ContabilidadSriConfigPage() {
  const toast = useToast()
  const location = useLocation()
  const canReadContabilidad = useHasPermission('contabilidad.configuracion.read')
  const canReadEmisor = useHasPermission('facturacion.emisor.read')
  const canReadTenant = useHasPermission('tenancy.tenant.read')
  const canRead = canReadContabilidad || canReadEmisor || canReadTenant
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
  const emitProfile = useMemo(
    () => getBillingEmitProfile(signature.emitProfile),
    [signature.emitProfile]
  )
  const statusTone = progress >= 100 ? 'success' : progress === 0 ? 'neutral' : 'warning'
  const statusLabel = progress >= 100 ? 'Listo' : progress === 0 ? 'Sin configurar' : 'Incompleto'
  const formDisabled = busy || loading || !canUpdate
  const title = pageTitle(location.pathname)
  const nextDocPreview = `${legal.establecimiento || '001'}-${legal.puntoEmision || '001'}-${legal.secuencialSiguiente || '000000001'}`

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
              'No se pudo leer el secuencial. Al guardar se intentará de nuevo.'
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
      toast.show({ title, message: 'No hay empresa seleccionada.', variant: 'error' })
      return
    }
    if (!tenantSnapshot) {
      toast.show({
        title,
        message: 'No hay ficha de empresa cargada. Recarga la página.',
        variant: 'error',
      })
      return
    }
    if (!canUpdate) {
      toast.show({
        title: 'Sin permiso',
        message: 'Necesitas permiso para guardar la configuración.',
        variant: 'error',
      })
      return
    }

    const ruc = legal.ruc.trim()
    if (ruc.length < 13) {
      toast.show({
        title: 'RUC incompleto',
        message: 'Indica un RUC de 13 dígitos para sincronizar el emisor.',
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
        title,
        message: companySynced
          ? `Guardado. Próximo ${savedSeq.establishment}-${savedSeq.emissionPoint}-${savedSeq.nextSequential} · ${profile.label}.`
          : `Guardado en Billing. La ficha legal requiere titular. Modo: ${profile.label}.`,
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
      <div className="ecu-dashboard-layout sri-config-page">
        <PageHeader
          title={title}
          subtitle="Requieres permiso de emisor, empresa o contabilidad para ver esta configuración."
          badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
        />
      </div>
    )
  }

  return (
    <div className="ecu-dashboard-layout sri-config-page">
      <PageHeader
        title={title}
        subtitle={
          companyLabel
            ? `Emisor, secuencial y firma electrónica — ${companyLabel}`
            : 'Configura el emisor SRI, el secuencial y la firma de la empresa.'
        }
        badge={
          <StatusBadge tone={statusTone} withDot>
            {statusLabel}
          </StatusBadge>
        }
        actions={
          canUpdate ? (
            <Button
              type="button"
              variant="primary"
              disabled={formDisabled}
              loading={busy}
              onClick={() => void onSubmit()}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          ) : undefined
        }
      />

      <PageLoadState
        loading={loading}
        error={loadError && !tenantId ? loadError : null}
        empty={!tenantId}
        emptyMessage="Entra a una empresa para configurar la facturación electrónica."
      >
        {loadError && tenantId ? (
          <div className="ecu-form-error-banner" role="status">
            <span className="material-symbols-outlined">info</span>
            <span>{loadError}</span>
          </div>
        ) : null}

        {!canUpdate ? (
          <div className="ecu-form-error-banner" role="status">
            <span className="material-symbols-outlined">lock</span>
            <span>Solo lectura: no tienes permiso para guardar.</span>
          </div>
        ) : null}

        {!canPersistCompany && canUpdate ? (
          <p className="ecu-companies-form__hint" role="note">
            Puedes ajustar emisión y secuencial. Para editar RUC y razón social usa el titular en{' '}
            <Link to="/organizacion/empresas">empresas</Link>.
          </p>
        ) : null}

        <div className="ecu-stat-grid" aria-label="Resumen de facturación electrónica">
          <StatCard
            label="Estado"
            value={statusLabel}
            icon="verified"
            toneColor={progress >= 100 ? '#10b981' : '#f59e0b'}
            footerText={`${progress}% de configuración`}
          />
          <StatCard
            label="Modo de emisión"
            value={emitProfile.isDevelopment ? 'Pruebas' : 'Producción'}
            icon="bolt"
            toneColor={emitProfile.isDevelopment ? '#f59e0b' : '#b42318'}
            footerText={emitProfile.label}
          />
          <StatCard
            label="Próximo comprobante"
            value={nextDocPreview}
            icon="receipt_long"
            toneColor="#4f46e5"
            footerText="Establecimiento · punto · secuencial"
          />
          <StatCard
            label="RUC emisor"
            value={legal.ruc.trim() || '—'}
            icon="badge"
            toneColor="#0284c7"
            footerText={legal.razonSocial.trim() || 'Sin razón social'}
          />
        </div>

        <div className="sri-config-page__stack ecu-companies-form">
          <SriIdentityCard
            values={legal}
            disabled={formDisabled || !canPersistCompany}
            onChange={canPersistCompany ? patchLegal : undefined}
          />

          <SectionCard
            title="Emisión SRI"
            subtitle="Establecimiento, punto de emisión y próximo secuencial"
          >
            <SriEmissionFields
              values={{
                establecimiento: legal.establecimiento,
                puntoEmision: legal.puntoEmision,
                secuencialSiguiente: legal.secuencialSiguiente,
              }}
              disabled={formDisabled}
              onChange={patchEmission}
              embedded
            />
          </SectionCard>

          <SectionCard
            title="Firma y modo"
            subtitle="Certificado electrónico y perfil de emisión hacia el SRI"
          >
            <SriSignatureSection
              values={signature}
              disabled={formDisabled}
              onChange={patchSignature}
              embedded
            />
          </SectionCard>

          <SectionCard
            title="Proveedor del sistema"
            subtitle="RUC del software en el campo adicional del comprobante"
          >
            <SriSoftwareProviderSection disabled={formDisabled} suggestedRuc={legal.ruc} embedded />
          </SectionCard>
        </div>
      </PageLoadState>
    </div>
  )
}
