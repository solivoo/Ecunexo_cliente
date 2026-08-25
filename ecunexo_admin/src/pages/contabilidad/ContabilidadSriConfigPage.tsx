import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, useToast } from 'glubox'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
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
  SriIdentityReadOnlyCard,
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
import { peekNextSequential, setNextSequential } from '@/services/billingApi'
import { getTenant } from '@/services/tenantApi'
import { selectTenantBranding, selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
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

export function ContabilidadSriConfigPage() {
  const toast = useToast()
  const location = useLocation()
  const isEmisorPage = location.pathname.includes('/facturacion/emisor')
  const canReadContabilidad = useHasPermission('contabilidad.configuracion.read')
  const canReadEmisor = useHasPermission('facturacion.emisor.read')
  const canRead = canReadContabilidad || canReadEmisor
  const canUpdate = useHasPermission('tenancy.tenant.update')
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

  const loadCompany = useCallback(async () => {
    if (!tenantId) {
      setLoadError('Entra a una empresa para configurar el SRI.')
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
          // Contabilidad sigue usable sin Billing; el secuencial se sincroniza al guardar.
          setLoadError(
            readApiError(
              billingErr,
              'No se pudo leer el secuencial en Billing.Api (:5203). Al guardar se intentará de nuevo.'
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
        title: 'Configuración SRI',
        message: 'No hay empresa seleccionada.',
        variant: 'error',
      })
      return
    }
    if (!tenantSnapshot) {
      toast.show({
        title: 'Configuración SRI',
        message: 'No hay ficha de empresa cargada. Recarga la página.',
        variant: 'error',
      })
      return
    }
    if (!canUpdate) {
      toast.show({
        title: 'Sin permiso',
        message: 'Necesitas `tenancy.tenant.update` para guardar.',
        variant: 'error',
      })
      return
    }

    const ruc = tenantSnapshot.taxId?.trim() ?? ''
    if (ruc.length < 13) {
      toast.show({
        title: 'RUC incompleto',
        message: 'Indica un RUC de 13 dígitos para sincronizar el secuencial de facturas.',
        variant: 'error',
      })
      return
    }

    setBusy(true)
    try {
      const emissionPoint = normalizeEmissionPoint(legal.puntoEmision)
      const establishment = normalizeEstablishmentCode(tenantSnapshot.establishmentCode)
      const nextSequential = normalizeSequentialInput(legal.secuencialSiguiente)
      storeBillingEmissionPoint(tenantId, emissionPoint)
      storeBillingEmitProfile(tenantId, signature.emitProfile)

      const legalName = tenantSnapshot.legalName?.trim() || tenantSnapshot.name
      const emitterId = await ensureBillingEmitter({
        emitterRuc: ruc,
        company: {
          legalName,
          tradeName: sriTradeName(tenantSnapshot.name, tenantSnapshot.legalName),
          address: tenantSnapshot.address?.trim() || '',
        },
        companyLabel: legalName,
        tenantId,
      })

      const savedSeq = await setNextSequential(emitterId, {
        nextSequential,
        establishment,
        emissionPoint,
        address: tenantSnapshot.address?.trim() || null,
      })

      const profile = getBillingEmitProfile(signature.emitProfile)
      toast.show({
        title: 'Configuración SRI',
        message: `Guardado. Próximo secuencial ${savedSeq.nextSequential} (estab ${savedSeq.establishment} / pto ${savedSeq.emissionPoint}). Modo: ${profile.label}.`,
        variant: 'success',
      })
      await loadCompany()
    } catch (err: unknown) {
      toast.show({
        title: 'Error al guardar',
        message: readApiError(err, 'No se pudo guardar la configuración SRI.'),
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [tenantId, tenantSnapshot, canUpdate, legal.puntoEmision, legal.secuencialSiguiente, signature.emitProfile, toast, loadCompany])

  if (!canRead) {
    return (
      <div className="sri-config-page">
        <h1 className="app-shell__page-title">{isEmisorPage ? 'Emisor' : 'Configuración SRI'}</h1>
        <p className="app-shell__page-lead">
          No tienes permiso para ver esta configuración.
        </p>
      </div>
    )
  }

  return (
    <div className="sri-config-page">
      <div>
        <h1 className="app-shell__page-title">{isEmisorPage ? 'Emisor' : 'Configuración SRI'}</h1>
        <p className="app-shell__page-lead">
          {isEmisorPage
            ? companyLabel
              ? `RUC, establecimiento, punto de emisión y certificado — ${companyLabel}`
              : 'Datos del emisor y certificado para firmar al SRI.'
            : companyLabel
              ? `Identidad legal y firma electrónica — ${companyLabel}`
              : 'Configure la identidad legal, obligaciones y firma electrónica de su empresa'}
        </p>
      </div>

      <PageLoadState
        loading={loading}
        error={loadError && !tenantId ? loadError : null}
        empty={!tenantId}
        emptyMessage="Entra a una empresa para configurar el SRI."
      >
        {loadError && tenantId ? (
          <p className="ecu-companies-form__hint" role="status">
            {loadError} Se muestran los datos de sesión disponibles.
          </p>
        ) : null}
        {!canUpdate ? (
          <p className="ecu-companies-form__hint" role="status">
            Solo lectura: falta permiso `tenancy.tenant.update` para guardar.
          </p>
        ) : null}
        <p className="ecu-companies-form__hint" role="note">
          La identidad legal es la misma ficha de la empresa. Aquí se ajustan firma, punto de
          emisión y secuencial.
        </p>
        <p className="ecu-companies-form__hint" role="note">
          El próximo secuencial es el que usará la siguiente factura (estab + punto). En producción,
          consulta el último autorizado en el portal SRI y configura último + 1. No rebobines por
          debajo del último ya usado en Billing.
        </p>

        <div className="sri-config-page__layout">
          <div className="sri-config-page__main ecu-companies-form">
            <SriIdentityReadOnlyCard values={legal} />
            <SriSoftwareProviderSection
              disabled={formDisabled}
              suggestedRuc={legal.ruc}
            />
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

