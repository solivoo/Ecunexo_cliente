import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from 'glubox'
import {
  getBillingEmitProfile,
  readBillingEmitProfile,
} from '@/lib/billingEmitProfile'
import { readBillingEmissionPoint } from '@/lib/billingSriEmission'
import { buildLineDescriptionFromCatalogItem } from '@/lib/catalogAttributes'
import {
  emitErrorTitle,
  emitToastTitle,
  getLastSriEmitTrace,
  loadIssuerDefaults,
  peekBillingNextSequential,
  readLoadError,
  readSaveError,
  saveInvoiceDraft,
  type CompanyDefaults,
  type InvoiceEmitMode,
  type SriEmitTrace,
} from '@/pages/facturacion/invoiceEmitApi'
import {
  buildRidePdfFromDetail,
  downloadInvoiceRide,
  printPdfBlob,
  type RidePdfResult,
} from '@/pages/facturacion/invoiceDownloads'
import {
  getSigningCertificateStatus,
  type SigningCertificateStatusDto,
} from '@/services/tenantApi'
import { toInvoiceDetailPreview } from '@/pages/facturacion/toInvoiceDetailPreview'
import {
  applyCounterpartyIdType,
  computeTotals,
  CONSUMIDOR_FINAL_BUSINESS_NAME,
  CONSUMIDOR_FINAL_IDENTIFICATION,
  createEmptyLine,
  DEFAULT_PAYMENT_FORM_CODE,
  defaultCustomerTypeForSriId,
  ID_TYPE_CONSUMIDOR_FINAL,
  ID_TYPE_OPTIONS,
  isConsumidorFinalType,
  isLineEmpty,
  normalizeCounterpartyForEmit,
  normalizeLineIvaRate,
  pricingToLinePatch,
  sriTypeToCustomerIdentificationType,
  validateCounterpartyForEmit,
  type InvoiceCounterpartyValues,
  type InvoiceHeaderValues,
  type InvoiceLineDraft,
} from '@/pages/facturacion/invoiceFormTypes'
import { getOrCreateCustomer } from '@/services/customersApi'
import { getEcommerceOrderById, linkEcommerceOrderInvoice } from '@/services/ecommerceApi'
import { resolvePrice } from '@/services/pricingApi'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { EcommerceOrderDetailDto } from '@/types/ecommerceApi'
import type { ResolvedShippingOptionDto } from '@/types/shippingApi'
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
  customerType: 1,
  address: '',
  city: '',
  email: '',
  phone: '',
}

const VALID_SRI_ID_TYPES: ReadonlySet<string> = new Set(
  ID_TYPE_OPTIONS.map((option) => option.value)
)

type EcommerceOrderInvoiceContext = {
  readonly orderId: string
  readonly orderNumber: string
  alreadyInvoiced: boolean
}

function isCounterpartyEmpty(counterparty: InvoiceCounterpartyValues): boolean {
  return (
    !counterparty.identification.trim() &&
    !counterparty.businessName.trim() &&
    !counterparty.address.trim() &&
    !counterparty.city.trim() &&
    !counterparty.email.trim() &&
    !counterparty.phone.trim()
  )
}

function orderBillingAddress(order: EcommerceOrderDetailDto): string {
  const fiscal = order.customer.address?.trim()
  if (fiscal) return fiscal
  return [order.shipping.addressLine1, order.shipping.addressLine2]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(', ')
}

function inferOrderIdentificationType(
  customer: EcommerceOrderDetailDto['customer']
): string {
  const declared = customer.taxIdType?.trim() ?? ''
  if (VALID_SRI_ID_TYPES.has(declared)) return declared
  const digits = (customer.taxId ?? '').replace(/\D/g, '')
  if (digits.length === 13) return '04'
  if (digits.length === 10) return '05'
  if (digits.length === 0) return ID_TYPE_CONSUMIDOR_FINAL
  return '06'
}

function buildOrderCounterparty(
  order: EcommerceOrderDetailDto
): InvoiceCounterpartyValues {
  const { customer, shipping } = order
  const identificationType = inferOrderIdentificationType(customer)
  const isFinalConsumer = isConsumidorFinalType(identificationType)
  return {
    ...INITIAL_COUNTERPARTY,
    identificationType,
    identification: isFinalConsumer
      ? CONSUMIDOR_FINAL_IDENTIFICATION
      : (customer.taxId ?? '').trim(),
    businessName: isFinalConsumer
      ? CONSUMIDOR_FINAL_BUSINESS_NAME
      : (customer.customerName ?? '').trim(),
    customerType: defaultCustomerTypeForSriId(identificationType),
    address: orderBillingAddress(order),
    city: (shipping.city ?? '').trim(),
    email: (customer.email ?? '').trim(),
    phone: (customer.phone ?? '').trim() || (shipping.recipientPhone ?? '').trim(),
  }
}

function normalizeOrderItemIvaRate(rate: number): number {
  const percent = rate > 0 && rate <= 1 ? rate * 100 : rate
  return normalizeLineIvaRate(Math.round(percent))
}

function buildOrderLines(order: EcommerceOrderDetailDto): InvoiceLineDraft[] {
  const lines: InvoiceLineDraft[] = order.items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      id: newLineId(),
      productId: item.catalogItemId,
      sku: (item.sku ?? '').trim().slice(0, 25),
      description: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discountAmount,
      ivaRate: normalizeOrderItemIvaRate(item.taxRate),
      catalogItemId: item.catalogItemId,
      itemKind: null,
    }))

  if (order.shippingCost && order.shippingCost > 0) {
    lines.push({
      id: newLineId(),
      productId: '',
      sku: 'ENV-TRANSPORTE',
      description: `Servicio de envío y entrega${order.shipping?.carrier ? ` (${order.shipping.carrier})` : ''}`,
      quantity: 1,
      unitPrice: order.shippingCost,
      discount: 0,
      ivaRate: 15,
      catalogItemId: null,
      itemKind: 'service',
    })
  }

  return lines
}

export type UseInvoiceEmitFormArgs = {
  readonly tenantId: string | null
  readonly branding: TenantBranding
  readonly canCreate: boolean
  readonly orderIdToInvoice?: string | null
  /** Lista de precios efectiva (del cliente o elegida manualmente); vacío = predeterminada. */
  readonly priceListId?: string | null
}

export function useInvoiceEmitForm({
  tenantId,
  branding,
  canCreate,
  orderIdToInvoice = null,
  priceListId = null,
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
  const resolveTokens = useRef(new Map<string, number>())
  const [rideOffer, setRideOffer] = useState<{
    readonly emitterId: string
    readonly invoiceId: string
  } | null>(null)
  const [ridePrinting, setRidePrinting] = useState(false)
  const [previewRide, setPreviewRide] = useState<RidePdfResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewPrinting, setPreviewPrinting] = useState(false)
  const [certStatus, setCertStatus] = useState<SigningCertificateStatusDto | null>(null)
  const [loadingCert, setLoadingCert] = useState(Boolean(tenantId))
  const [lastTrace, setLastTrace] = useState<SriEmitTrace | null>(() => getLastSriEmitTrace())
  const [traceOpen, setTraceOpen] = useState(false)
  const [billingOrder, setBillingOrder] = useState<{
    readonly orderId: string
    readonly orderNumber: string
  } | null>(null)
  const prefilledOrderRef = useRef<string | null>(null)
  const linkedOrderRef = useRef<EcommerceOrderInvoiceContext | null>(null)

  const [emitProfileId, setEmitProfileId] = useState(() =>
    readBillingEmitProfile(tenantId)
  )

  const emitProfile = getBillingEmitProfile(emitProfileId)

  const hasValidCertificate = Boolean(
    certStatus?.isConfigured && !certStatus?.isExpired
  )

  useEffect(() => {
    setEmitProfileId(readBillingEmitProfile(tenantId))
  }, [tenantId])

  useEffect(() => {
    const refresh = () => {
      setEmitProfileId(readBillingEmitProfile(tenantId))
      if (tenantId) {
        void getSigningCertificateStatus(tenantId)
          .then((st) => setCertStatus(st))
          .catch(() => setCertStatus(null))
      }
    }
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
      setCertStatus(null)
      setLoadingCert(false)
      return
    }

    let cancelled = false
    setLoadingTenant(true)
    setLoadingCert(true)
    setLoadError(null)

    void (async () => {
      try {
        const cert = await getSigningCertificateStatus(tenantId)
        if (!cancelled) setCertStatus(cert)
      } catch {
        if (!cancelled) setCertStatus(null)
      } finally {
        if (!cancelled) setLoadingCert(false)
      }
    })()

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
              environment: emitProfile.sriEnvironment ?? 'Production',
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
  }, [tenantId, emitProfile.sriEnvironment])

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
        environment: emitProfile.sriEnvironment ?? 'Production',
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
    emitProfile.sriEnvironment,
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

  useEffect(() => {
    if (!tenantId || !orderIdToInvoice) return
    if (prefilledOrderRef.current === orderIdToInvoice) return
    prefilledOrderRef.current = orderIdToInvoice

    void getEcommerceOrderById(tenantId, orderIdToInvoice)
      .then((order) => {
        linkedOrderRef.current = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          alreadyInvoiced: Boolean(order.billingInvoiceId),
        }
        setBillingOrder({ orderId: order.id, orderNumber: order.orderNumber })
        setCounterparty((prev) =>
          isCounterpartyEmpty(prev) ? buildOrderCounterparty(order) : prev
        )
        setLines((prev) =>
          prev.every(isLineEmpty)
            ? [...buildOrderLines(order), createEmptyLine(newLineId())]
            : prev
        )
      })
      .catch((err: unknown) => {
        prefilledOrderRef.current = null
        toast.show({
          title: 'Pedido',
          message: readApiError(err, 'No se pudo cargar el pedido para facturar.'),
          variant: 'warning',
        })
      })
  }, [tenantId, orderIdToInvoice, toast])

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

  const replaceCounterparty = useCallback((next: InvoiceCounterpartyValues) => {
    setCounterparty(next)
  }, [])

  const ensureTrailingEmptyLine = useCallback((currentLines: InvoiceLineDraft[]): InvoiceLineDraft[] => {
    if (currentLines.length === 0) {
      return [createEmptyLine(newLineId())]
    }
    const last = currentLines[currentLines.length - 1]
    if (last.productId || last.description.trim()) {
      return [...currentLines, createEmptyLine(newLineId())]
    }
    return currentLines
  }, [])

  const addLine = useCallback(() => {
    setLines((prev) => ensureTrailingEmptyLine([...prev, createEmptyLine(newLineId())]))
  }, [ensureTrailingEmptyLine])

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => {
      const filtered = prev.filter((l) => l.id !== lineId)
      return ensureTrailingEmptyLine(filtered)
    })
  }, [ensureTrailingEmptyLine])

  const patchLine = useCallback(
    (lineId: string, patch: Partial<InvoiceLineDraft>) => {
      setLines((prev) => {
        const updated = prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l))
        return ensureTrailingEmptyLine(updated)
      })

      if (patch.quantity === undefined || !tenantId) return

      const target = lines.find((l) => l.id === lineId)
      if (!target?.catalogItemId || target.itemKind !== 'physical') return

      const quantity = Math.max(1, patch.quantity)
      const token = (resolveTokens.current.get(lineId) ?? 0) + 1
      resolveTokens.current.set(lineId, token)

      void resolvePrice(tenantId, {
        catalogItemId: target.catalogItemId,
        quantity,
        date: todayIsoDate(),
        priceListId: priceListId || undefined,
      })
        .then((resolved) => {
          if (resolveTokens.current.get(lineId) !== token) return
          setLines((prev) =>
            ensureTrailingEmptyLine(
              prev.map((l) =>
                l.id === lineId ? { ...l, ...pricingToLinePatch(resolved, quantity) } : l
              )
            )
          )
        })
        .catch(() => {
          // Sin pricing configurado se conserva el precio actual de la línea.
        })
    },
    [ensureTrailingEmptyLine, lines, priceListId, tenantId]
  )

  const addProductLine = useCallback(
    (item: CatalogItemListItemDto, quantity = 1, targetLineId?: string | null) => {
      const normalizedQuantity = Math.max(1, quantity)

      const applyLine = (pricePatch: Partial<InvoiceLineDraft>) => {
        setLines((prev) => {
          const linePatch: Partial<InvoiceLineDraft> = {
            productId: item.id,
            catalogItemId: item.id,
            itemKind: item.kind === CatalogItemKind.Physical ? 'physical' : 'service',
            sku: (item.sku ?? '').trim().slice(0, 25),
            description: buildLineDescriptionFromCatalogItem(item),
            unitPrice: item.basePrice ?? 0,
            quantity: normalizedQuantity,
            ivaRate: normalizeLineIvaRate(15),
            ...pricePatch,
          }

          let updated: InvoiceLineDraft[]
          if (targetLineId) {
            updated = prev.map((l) => (l.id === targetLineId ? { ...l, ...linePatch } : l))
          } else {
            const emptyLine = prev.find((l) => !l.productId && !l.description.trim())
            if (emptyLine) {
              updated = prev.map((l) => (l.id === emptyLine.id ? { ...l, ...linePatch } : l))
            } else {
              const newLine: InvoiceLineDraft = {
                ...createEmptyLine(newLineId()),
                ...linePatch,
              }
              updated = [...prev, newLine]
            }
          }
          return ensureTrailingEmptyLine(updated)
        })
      }

      if (!tenantId || item.kind !== CatalogItemKind.Physical) {
        applyLine({})
        return
      }

      void resolvePrice(tenantId, {
        catalogItemId: item.id,
        quantity: normalizedQuantity,
        date: todayIsoDate(),
        priceListId: priceListId || undefined,
      })
        .then((resolved) => {
          applyLine(pricingToLinePatch(resolved, normalizedQuantity))
        })
        .catch(() => {
          applyLine({})
          toast.show({
            title: 'Precio no encontrado',
            message: `«${item.name}» no tiene precio vigente en la lista predeterminada; se usó el precio base (${item.basePrice ?? 0}). Configúralo en Catálogo → Gestión de precios.`,
            variant: 'warning',
          })
        })
    },
    [ensureTrailingEmptyLine, tenantId, toast, priceListId]
  )

  const addShippingRateLine = useCallback(
    (rate: ResolvedShippingOptionDto) => {
      setLines((prev) => {
        const linePatch: Partial<InvoiceLineDraft> = {
          productId: '',
          catalogItemId: null,
          itemKind: 'service',
          sku: 'ENV-TRANSPORTE',
          description: `Servicio de envío: ${rate.name} (${rate.carrier} - ${rate.zone})`,
          unitPrice: rate.basePrice,
          quantity: 1,
          discount: 0,
          ivaRate: normalizeLineIvaRate(rate.taxRate ?? 15),
        }

        const emptyLine = prev.find((l) => !l.productId && !l.description.trim())
        if (emptyLine) {
          return prev.map((l) => (l.id === emptyLine.id ? { ...l, ...linePatch } : l))
        }
        return [...prev, { ...createEmptyLine(newLineId()), ...linePatch }]
      })
    },
    []
  )

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
      if (mode !== 'draft' && !hasValidCertificate) {
        toast.show({
          title: 'Firma electrónica no configurada',
          message:
            'Esta empresa no tiene un certificado de firma digital (.p12) registrado o está vencido. Debe cargar su firma en Ajustes de Empresa para emitir ante el SRI.',
          variant: 'error',
        })
        return
      }

      const counterpartyPayload = normalizeCounterpartyForEmit(counterparty)

      setBusy(true)
      try {
        if (tenantId && !isConsumidorFinalType(counterpartyPayload.identificationType)) {
          try {
            await getOrCreateCustomer(tenantId, {
              name: counterpartyPayload.businessName.trim(),
              taxId: counterpartyPayload.identification.trim(),
              customerType: (counterpartyPayload.customerType || 2) as any,
              identificationType: sriTypeToCustomerIdentificationType(
                counterpartyPayload.identificationType
              ) as any,
              contactEmail: counterpartyPayload.email.trim() || null,
              contactPhone: counterpartyPayload.phone.trim() || null,
              address: counterpartyPayload.address.trim() || null,
              returnExistingIfExists: true,
            })
          } catch (syncErr: unknown) {
            console.warn('[AutoCustomerSync] No se pudo sincronizar el cliente en el directorio:', syncErr)
          }
        }

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
        setLastTrace(result.trace ?? getLastSriEmitTrace())
        toast.show({
          title: result.outcome === 'success' ? 'Factura generada con éxito' : emitToastTitle(result.mode, result.outcome),
          message: result.outcome === 'success' ? 'Factura generada con éxito.' : result.message,
          variant: result.outcome === 'success' ? 'success' : result.outcome === 'warning' ? 'warning' : 'error',
        })
        if (result.emailStatus === 'failed') {
          toast.show({
            title: 'Correo al cliente',
            message:
              'La factura se autorizó, pero no se pudo enviar el correo con RIDE y XML. Puedes reenviarlo desde el listado de facturas.',
            variant: 'warning',
          })
        } else if (result.emailStatus === 'skipped') {
          toast.show({
            title: 'Correo al cliente',
            message:
              'El cliente no tiene correo registrado en la factura; no se envió el RIDE ni el XML por email.',
            variant: 'warning',
          })
        }
        await refreshSequentialPreview()
        if (result.outcome !== 'error') {
          const orderContext = linkedOrderRef.current
          if (tenantId && orderContext && !orderContext.alreadyInvoiced) {
            try {
              await linkEcommerceOrderInvoice(tenantId, orderContext.orderId, {
                billingInvoiceId: result.invoiceId,
              })
              linkedOrderRef.current = { ...orderContext, alreadyInvoiced: true }
              toast.show({
                title: 'Pedido vinculado',
                message: `La factura quedó vinculada al pedido ${orderContext.orderNumber}.`,
                variant: 'success',
              })
            } catch {
              toast.show({
                title: 'Vinculación manual requerida',
                message: `La factura se emitió con ID ${result.invoiceId}, pero no se pudo vincular al pedido ${orderContext.orderNumber}. Usa «Vincular Factura SRI» en el detalle del pedido.`,
                variant: 'warning',
              })
            }
          }
          resetFormAfterSuccessfulEmit()
          setRideOffer({
            emitterId: result.emitterId,
            invoiceId: result.invoiceId,
          })
        }
      } catch (err: unknown) {
        setLastTrace(getLastSriEmitTrace())
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
    billingOrder,
    companyLabel,
    requiresNotaVenta: company?.salesDocumentKind === 'nota-venta',
    emitProfile,
    certStatus,
    loadingCert,
    hasValidCertificate,
    lastTrace,
    traceOpen,
    setTraceOpen,
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
    replaceCounterparty,
    addLine,
    removeLine,
    patchLine,
    addProductLine,
    addShippingRateLine,
    onSubmit,
  }
}
