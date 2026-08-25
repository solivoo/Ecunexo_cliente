import { useCallback, useEffect, useState } from 'react'
import { useToast } from 'glubox'
import {
  getBillingEmitProfile,
  readBillingEmitProfile,
} from '@/lib/billingEmitProfile'
import { readBillingEmissionPoint } from '@/lib/billingSriEmission'
import {
  emitErrorTitle,
  emitToastTitle,
  loadIssuerDefaults,
  peekBillingNextSequential,
  readLoadError,
  readSaveError,
  saveInvoiceDraft,
  type CompanyDefaults,
  type InvoiceEmitMode,
} from '@/pages/facturacion/invoiceEmitApi'
import {
  buildRidePdfFromDetail,
  downloadInvoiceRide,
  printPdfBlob,
  type RidePdfResult,
} from '@/pages/facturacion/invoiceDownloads'
import { toInvoiceDetailPreview } from '@/pages/facturacion/toInvoiceDetailPreview'
import {
  applyCounterpartyIdType,
  computeTotals,
  createEmptyLine,
  DEFAULT_PAYMENT_FORM_CODE,
  isConsumidorFinalType,
  normalizeCounterpartyForEmit,
  validateCounterpartyForEmit,
  type InvoiceCounterpartyValues,
  type InvoiceHeaderValues,
  type InvoiceLineDraft,
} from '@/pages/facturacion/invoiceFormTypes'
import type { TenantBranding } from '@/types/tenantBranding'
import { readApiError } from '@/lib/readApiError'

/** Fecha civil en Ecuador (no UTC): toISOString() tras ~19:00 local adelanta un día y el SRI rechaza (65). */
function todayIsoDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function newLineId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `line-${Date.now()}-${Math.random()}`
}

const INITIAL_COUNTERPARTY: InvoiceCounterpartyValues = {
  identificationType: '04',
  identification: '',
  businessName: '',
  address: '',
  email: '',
  phone: '',
}

export type UseInvoiceEmitFormArgs = {
  readonly tenantId: string | null
  readonly branding: TenantBranding
  readonly canCreate: boolean
}

export function useInvoiceEmitForm({
  tenantId,
  branding,
  canCreate,
}: UseInvoiceEmitFormArgs) {
  const toast = useToast()
  const [loadingTenant, setLoadingTenant] = useState(Boolean(tenantId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyDefaults | null>(null)
  const [issuerLocked, setIssuerLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [header, setHeader] = useState<InvoiceHeaderValues>(() => ({
    emitterRuc: '',
    establishment: '001',
    emissionPoint: '001',
    sequential: '—',
    issueDate: todayIsoDate(),
    paymentFormCode: DEFAULT_PAYMENT_FORM_CODE,
    additionalNote: '',
    paymentTermDays: 0,
  }))
  const [counterparty, setCounterparty] =
    useState<InvoiceCounterpartyValues>(INITIAL_COUNTERPARTY)
  const [lines, setLines] = useState(() => [createEmptyLine(newLineId())])
  const [rideOffer, setRideOffer] = useState<{
    readonly emitterId: string
    readonly invoiceId: string
  } | null>(null)
  const [ridePrinting, setRidePrinting] = useState(false)
  const [previewRide, setPreviewRide] = useState<RidePdfResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewPrinting, setPreviewPrinting] = useState(false)

  const [emitProfileId, setEmitProfileId] = useState(() =>
    readBillingEmitProfile(tenantId)
  )

  const emitProfile = getBillingEmitProfile(emitProfileId)

  useEffect(() => {
    setEmitProfileId(readBillingEmitProfile(tenantId))
  }, [tenantId])

  useEffect(() => {
    const refresh = () => setEmitProfileId(readBillingEmitProfile(tenantId))
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [tenantId])

  const companyLabel =
    company?.tradeName?.trim() ||
    company?.legalName?.trim() ||
    branding.name ||
    ''

  useEffect(() => {
    if (!tenantId) {
      setLoadingTenant(false)
      setLoadError(null)
      return
    }

    let cancelled = false
    setLoadingTenant(true)
    setLoadError(null)

    void (async () => {
      try {
        const defaults = await loadIssuerDefaults(tenantId)
        if (cancelled) return
        const emissionPoint = readBillingEmissionPoint(tenantId)
        setCompany(defaults.company)
        setIssuerLocked(defaults.issuerLocked)

        let sequential = '—'
        if (defaults.emitterRuc.length >= 13) {
          try {
            sequential = await peekBillingNextSequential({
              emitterRuc: defaults.emitterRuc,
              company: defaults.company,
              companyLabel:
                defaults.company.tradeName?.trim() ||
                defaults.company.legalName ||
                defaults.emitterRuc,
              establishment: defaults.establishment,
              emissionPoint,
              tenantId,
            })
          } catch {
            sequential = '—'
          }
        }
        if (cancelled) return

        setHeader((prev) => ({
          ...prev,
          emitterRuc: defaults.emitterRuc || prev.emitterRuc,
          establishment: defaults.establishment,
          emissionPoint,
          sequential,
          issueDate: todayIsoDate(),
        }))
      } catch (err: unknown) {
        if (!cancelled) setLoadError(readLoadError(err))
      } finally {
        if (!cancelled) setLoadingTenant(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId])

  const refreshSequentialPreview = useCallback(async () => {
    const ruc = company?.taxId.trim() || header.emitterRuc.trim()
    if (!ruc || ruc.length < 13) return
    try {
      const next = await peekBillingNextSequential({
        emitterRuc: ruc,
        company,
        companyLabel,
        establishment: company?.establishment || header.establishment,
        emissionPoint: header.emissionPoint,
        tenantId,
      })
      setHeader((prev) => ({ ...prev, sequential: next }))
    } catch {
      // La emisión sigue asignando en servidor; la UI solo es preview.
    }
  }, [
    header.emitterRuc,
    header.establishment,
    header.emissionPoint,
    company,
    companyLabel,
    tenantId,
  ])

  useEffect(() => {
    if (loadingTenant || !(company?.taxId.trim() || header.emitterRuc.trim())) return
    void refreshSequentialPreview()
  }, [
    company?.taxId,
    header.establishment,
    header.emissionPoint,
    header.emitterRuc,
    loadingTenant,
    refreshSequentialPreview,
  ])

  const patchHeader = useCallback(
    <K extends keyof InvoiceHeaderValues>(key: K, value: InvoiceHeaderValues[K]) => {
      if (key === 'sequential' || key === 'establishment' || key === 'emissionPoint') return
      if (key === 'emitterRuc' && issuerLocked) return
      setHeader((prev) => ({ ...prev, [key]: value }))
    },
    [issuerLocked]
  )

  const patchCounterparty = useCallback(
    <K extends keyof InvoiceCounterpartyValues>(
      key: K,
      value: InvoiceCounterpartyValues[K]
    ) => {
      setCounterparty((prev) => {
        if (key === 'identificationType') {
          return applyCounterpartyIdType(prev, String(value))
        }
        if (
          isConsumidorFinalType(prev.identificationType) &&
          (key === 'identification' || key === 'businessName')
        ) {
          return prev
        }
        return { ...prev, [key]: value }
      })
    },
    []
  )

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, createEmptyLine(newLineId())])
  }, [])

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== lineId)))
  }, [])

  const patchLine = useCallback((lineId: string, patch: Partial<InvoiceLineDraft>) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }, [])

  /** Limpia cliente/líneas/notas tras crear comprobante; conserva emisor y punto de emisión. */
  const resetFormAfterSuccessfulEmit = useCallback(() => {
    setCounterparty(INITIAL_COUNTERPARTY)
    setLines([createEmptyLine(newLineId())])
    setHeader((prev) => ({
      ...prev,
      issueDate: todayIsoDate(),
      paymentFormCode: DEFAULT_PAYMENT_FORM_CODE,
      additionalNote: '',
      paymentTermDays: 0,
    }))
  }, [])

  const onPreview = useCallback(async () => {
    if (!lines.some((l) => l.productId || l.description.trim())) {
      toast.show({
        title: 'Factura incompleta',
        message: 'Agregar al menos una línea con producto o descripción.',
        variant: 'error',
      })
      return
    }
    const counterpartyError = validateCounterpartyForEmit(
      counterparty,
      computeTotals(lines).grandTotal
    )
    if (counterpartyError) {
      toast.show({
        title: 'Cliente incompleto',
        message: counterpartyError,
        variant: 'error',
      })
      return
    }
    if (!company?.taxId.trim() && !header.emitterRuc.trim()) {
      toast.show({
        title: 'Emisor incompleto',
        message: 'Configure el RUC en Facturación → Emisor.',
        variant: 'error',
      })
      return
    }

    setPreviewing(true)
    try {
      const detail = toInvoiceDetailPreview({
        header,
        counterparty: normalizeCounterpartyForEmit(counterparty),
        lines,
        company,
        companyLabel,
      })
      const pdf = await buildRidePdfFromDetail(detail)
      setPreviewRide(pdf)
    } catch (err: unknown) {
      toast.show({
        title: 'Previsualizar',
        message: readApiError(err, 'No se pudo generar la vista previa.'),
        variant: 'error',
      })
    } finally {
      setPreviewing(false)
    }
  }, [lines, counterparty, header, company, companyLabel, toast])

  const dismissPreview = useCallback(() => {
    if (!previewPrinting) setPreviewRide(null)
  }, [previewPrinting])

  const confirmPreviewPrint = useCallback(async () => {
    if (!previewRide || previewPrinting) return
    setPreviewPrinting(true)
    try {
      await printPdfBlob(previewRide.blob)
      toast.show({
        title: 'Impresión',
        message: 'Se abrió el diálogo de impresión del RIDE.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Impresión',
        message: readApiError(err, 'No se pudo imprimir la vista previa.'),
        variant: 'error',
      })
    } finally {
      setPreviewPrinting(false)
    }
  }, [previewRide, previewPrinting, toast])

  const onSubmit = useCallback(
    async (modeOverride?: InvoiceEmitMode) => {
      const mode = modeOverride ?? (emitProfile.emitMode as InvoiceEmitMode)
      if (!canCreate) {
        toast.show({
          title: 'Sin permiso',
          message: 'Se requiere el permiso facturacion.facturas.create.',
          variant: 'error',
        })
        return
      }
      if (!lines.some((l) => l.productId || l.description.trim())) {
        toast.show({
          title: 'Factura incompleta',
          message: 'Agregar al menos una línea con producto o descripción.',
          variant: 'error',
        })
        return
      }
      const counterpartyError = validateCounterpartyForEmit(
        counterparty,
        computeTotals(lines).grandTotal
      )
      if (counterpartyError) {
        toast.show({
          title: 'Cliente incompleto',
          message: counterpartyError,
          variant: 'error',
        })
        return
      }
      if (!company?.taxId.trim() && !header.emitterRuc.trim()) {
        toast.show({
          title: 'Emisor incompleto',
          message: 'Configure el RUC en Facturación → Emisor.',
          variant: 'error',
        })
        return
      }
      if (company?.salesDocumentKind === 'nota-venta') {
        toast.show({
          title: 'Nota de venta',
          message:
            'Esta empresa es negocio popular y emite nota de venta, no factura 01. En Facturación → Emisor puedes elegir factura electrónica (opción SRI).',
          variant: 'error',
        })
        return
      }

      const counterpartyPayload = normalizeCounterpartyForEmit(counterparty)

      setBusy(true)
      try {
        const result = await saveInvoiceDraft({
          header,
          counterparty: counterpartyPayload,
          lines,
          company,
          companyLabel,
          mode,
          sriEnvironment: emitProfile.sriEnvironment,
          tenantId,
        })
        toast.show({
          title: emitToastTitle(result.mode, result.outcome),
          message: result.message,
          variant: result.outcome === 'success' ? 'success' : result.outcome === 'warning' ? 'warning' : 'error',
        })
        await refreshSequentialPreview()
        if (result.outcome !== 'error') {
          resetFormAfterSuccessfulEmit()
          setRideOffer({
            emitterId: result.emitterId,
            invoiceId: result.invoiceId,
          })
        }
      } catch (err: unknown) {
        toast.show({
          title: emitErrorTitle(mode),
          message: readSaveError(err),
          variant: 'error',
        })
      } finally {
        setBusy(false)
      }
    },
    [
      canCreate,
      lines,
      counterparty,
      header,
      company,
      companyLabel,
      emitProfile,
      toast,
      refreshSequentialPreview,
      resetFormAfterSuccessfulEmit,
      tenantId,
    ]
  )

  const dismissRideOffer = useCallback(() => {
    if (!ridePrinting) setRideOffer(null)
  }, [ridePrinting])

  const confirmRidePrint = useCallback(async () => {
    if (!rideOffer || ridePrinting) return
    setRidePrinting(true)
    try {
      const pdf = await downloadInvoiceRide(rideOffer.emitterId, rideOffer.invoiceId)
      await printPdfBlob(pdf.blob)
      toast.show({
        title: 'RIDE',
        message: `Generado e impresión solicitada: ${pdf.filename}`,
        variant: 'success',
      })
      setRideOffer(null)
    } catch (err: unknown) {
      toast.show({
        title: 'RIDE',
        message: readApiError(err, 'No se pudo generar o imprimir el RIDE.'),
        variant: 'error',
      })
    } finally {
      setRidePrinting(false)
    }
  }, [rideOffer, ridePrinting, toast])

  return {
    loadingTenant,
    loadError,
    issuerLocked,
    busy,
    header,
    counterparty,
    lines,
    companyLabel,
    requiresNotaVenta: company?.salesDocumentKind === 'nota-venta',
    emitProfile,
    formDisabled:
      busy ||
      previewing ||
      !canCreate ||
      loadingTenant ||
      company?.salesDocumentKind === 'nota-venta',
    rideOfferOpen: rideOffer !== null,
    ridePrinting,
    previewRide,
    previewing,
    previewPrinting,
    dismissRideOffer,
    confirmRidePrint,
    dismissPreview,
    confirmPreviewPrint,
    onPreview,
    patchHeader,
    patchCounterparty,
    addLine,
    removeLine,
    patchLine,
    onSubmit,
  }
}
