import { readApiError } from '@/lib/readApiError'
import { normalizeEstablishmentCode } from '@/pages/facturacion/invoiceFormTypes'
import type {
  InvoiceCounterpartyValues,
  InvoiceHeaderValues,
  InvoiceLineDraft,
} from '@/pages/facturacion/invoiceFormTypes'
import { toCreateInvoiceBody } from '@/pages/facturacion/toCreateInvoiceBody'
import {
  createCreditNote,
  createEmitter,
  createInvoice,
  getInvoiceSriStatus,
  peekNextSequential,
  previewInvoiceXml,
  retryInvoiceSri,
  signInvoice,
} from '@/services/billingApi'
import { normalizeEmissionPoint } from '@/lib/billingSriEmission'
import {
  parseRimpeKind,
  resolveSalesDocumentKind,
} from '@/features/organization/rimpeKind'
import { getTenant } from '@/services/tenantApi'

export type CompanyDefaults = {
  readonly legalName: string
  readonly tradeName: string | null
  readonly address: string
  readonly taxId: string
  readonly establishment: string
  readonly salesDocumentKind: 'nota-venta' | 'factura-electronica'
}

/** XML nombreComercial: el nombre de empresa, omitido si coincide con la razón social. */
export function sriTradeName(
  companyName: string,
  legalName: string | null | undefined
): string | null {
  const name = companyName.trim()
  const legal = legalName?.trim() ?? ''
  if (name.length === 0) {
    return null
  }
  if (legal.length > 0 && name.localeCompare(legal, 'es', { sensitivity: 'accent' }) === 0) {
    return null
  }
  return name
}

export type LoadedIssuerDefaults = {
  readonly company: CompanyDefaults
  readonly emitterRuc: string
  readonly establishment: string
  readonly issuerLocked: boolean
}

/** draft = create+XSD | sign = +XAdES | sri = +recepción+autorización */
export type InvoiceEmitMode = 'draft' | 'sign' | 'sri'

export type SriEmitTrace = {
  readonly timestamp: string
  readonly mode: InvoiceEmitMode
  readonly environment: 'Test' | 'Production'
  readonly environmentCode: '1' | '2'
  readonly emitterRuc: string
  readonly establishment: string
  readonly emissionPoint: string
  readonly sequentialRequested: string
  requestPayload?: unknown
  createdInvoice?: {
    readonly invoiceId: string
    readonly state: string
    readonly grandTotal: number
    readonly sequential?: string
  } | null
  previewXml?: {
    readonly accessKey: string
    readonly environmentDigit: string
    readonly isValid: boolean
    readonly errors: readonly string[]
    readonly xmlText?: string
  } | null
  signResult?: {
    readonly accessKey: string | null
    readonly environmentDigit: string | null
    readonly state: string
    readonly message: string
  } | null
  sriResult?: {
    readonly state: string
    readonly sriTransmissionState: string | null
    readonly accessKey: string | null
    readonly messages: readonly { identifier: string; text: string; detail?: string | null }[]
  } | null
  rawError?: string | null
}

let lastSriEmitTrace: SriEmitTrace | null = null

export function getLastSriEmitTrace(): SriEmitTrace | null {
  return lastSriEmitTrace
}

export function setLastSriEmitTrace(trace: SriEmitTrace | null): void {
  lastSriEmitTrace = trace
}

export type SaveInvoiceResult = {
  readonly invoiceId: string
  readonly emitterId: string
  readonly message: string
  readonly mode: InvoiceEmitMode
  readonly accessKey: string | null
  readonly state: string | null
  readonly sriTransmissionState: string | null
  /** success | warning | error — para el toast de la UI */
  readonly outcome: 'success' | 'warning' | 'error'
  readonly trace?: SriEmitTrace | null
}

export async function loadIssuerDefaults(tenantId: string): Promise<LoadedIssuerDefaults> {
  const tenant = await getTenant(tenantId)
  const taxId = tenant.taxId?.trim() ?? ''
  return {
    company: {
      legalName: tenant.legalName?.trim() || tenant.name,
      tradeName: sriTradeName(tenant.name, tenant.legalName),
      address: tenant.address?.trim() || '',
      taxId,
      establishment: normalizeEstablishmentCode(tenant.establishmentCode),
      salesDocumentKind:
        tenant.salesDocumentKind === 'nota-venta' || tenant.salesDocumentKind === 'factura-electronica'
          ? tenant.salesDocumentKind
          : resolveSalesDocumentKind(
              parseRimpeKind(tenant.rimpeKind, tenant.isRimpe),
              Boolean(tenant.preferElectronicInvoice)
            ),
    },
    emitterRuc: taxId,
    establishment: normalizeEstablishmentCode(tenant.establishmentCode),
    issuerLocked: taxId.length >= 13,
  }
}

const ensureEmitterInflight = new Map<string, Promise<string>>()

export async function ensureBillingEmitter(args: {
  readonly emitterRuc: string
  readonly company: Pick<CompanyDefaults, 'legalName' | 'tradeName' | 'address'> | null
  readonly companyLabel: string
  readonly tenantId?: string | null
}): Promise<string> {
  const ruc = args.emitterRuc.trim()
  if (!ruc) {
    throw new Error('Configure el RUC del emisor en Facturación → Emisor.')
  }

  const lockKey = `${args.tenantId?.trim() || 'global'}:${ruc}`
  const pending = ensureEmitterInflight.get(lockKey)
  if (pending) return pending

  const run = (async () => {
    // API get-or-create por RUC/tenant (no cache local: evita emisores vacíos legacy).
    const resolved = await createEmitter(
      {
        ruc,
        businessName: args.company?.legalName || args.companyLabel || ruc,
        mainAddress: args.company?.address || 'Dirección matriz pendiente',
        tradeName: args.company?.tradeName || args.companyLabel || null,
      },
      args.tenantId
    )
    return resolved.emitterId
  })()

  ensureEmitterInflight.set(lockKey, run)
  try {
    return await run
  } finally {
    ensureEmitterInflight.delete(lockKey)
  }
}

/** Vista previa del próximo secuencial (solo lectura UI). La asignación real es en el servidor. */
export async function peekBillingNextSequential(args: {
  readonly emitterRuc: string
  readonly company: CompanyDefaults | null
  readonly companyLabel: string
  readonly establishment: string
  readonly emissionPoint: string
  readonly tenantId?: string | null
  readonly environment?: 'Test' | 'Production' | string | null
}): Promise<string> {
  const emitterId = await ensureBillingEmitter({
    emitterRuc: args.emitterRuc,
    company: args.company,
    companyLabel: args.companyLabel,
    tenantId: args.tenantId,
  })
  const peeked = await peekNextSequential(emitterId, {
    establishment: normalizeEstablishmentCode(args.establishment),
    emissionPoint: normalizeEmissionPoint(args.emissionPoint),
    environment: args.environment ?? 'Production',
  })
  return peeked.nextSequential
}

export async function saveInvoiceDraft(args: {
  readonly header: InvoiceHeaderValues
  readonly counterparty: InvoiceCounterpartyValues
  readonly lines: readonly InvoiceLineDraft[]
  readonly company: CompanyDefaults | null
  readonly companyLabel: string
  readonly mode?: InvoiceEmitMode
  readonly sriEnvironment?: 'Test' | 'Production' | null
  readonly tenantId?: string | null
}): Promise<SaveInvoiceResult> {
  const mode = args.mode ?? 'draft'
  const emitterRuc = args.company?.taxId.trim() || args.header.emitterRuc.trim()
  const header: InvoiceHeaderValues = {
    ...args.header,
    emitterRuc,
    establishment: args.company?.establishment || args.header.establishment,
  }
  const env: 'Test' | 'Production' = args.sriEnvironment === 'Test' ? 'Test' : 'Production'
  const envCode = env === 'Production' ? '2' : '1'

  const requestedSeq =
    header.sequential &&
    header.sequential !== '—' &&
    /^\d{1,9}$/.test(header.sequential.trim())
      ? header.sequential.trim().padStart(9, '0')
      : 'auto'

  const body = toCreateInvoiceBody(header, args.counterparty, args.lines, env)

  const trace: SriEmitTrace = {
    timestamp: new Date().toISOString(),
    mode,
    environment: env,
    environmentCode: envCode,
    emitterRuc,
    establishment: header.establishment,
    emissionPoint: header.emissionPoint,
    sequentialRequested: requestedSeq,
    requestPayload: body,
    createdInvoice: null,
    previewXml: null,
    signResult: null,
    sriResult: null,
    rawError: null,
  }

  console.group(`🚀 [EcuNexo SRI Emisión] Factura -> ${env} (Ambiente ${envCode})`)
  console.log('📌 Configuración & Destino:', {
    ambiente: env,
    codigoAmbiente: envCode,
    modo: mode,
    emisorRuc: emitterRuc,
    serie: `${header.establishment}-${header.emissionPoint}`,
    secuencialSolicitado: requestedSeq,
  })
  console.log('📦 Request Payload (createInvoice):', body)

  try {
    const emitterId = await ensureBillingEmitter({
      emitterRuc,
      company: args.company,
      companyLabel: args.companyLabel,
      tenantId: args.tenantId,
    })

    const created = await createInvoice(emitterId, body, args.tenantId)
    trace.createdInvoice = {
      invoiceId: created.invoiceId,
      state: created.state,
      grandTotal: created.grandTotal,
      sequential: created.sequential,
    }
    console.log('✅ Factura Creada en Billing.Api:', created)

    let xmlNote = ''
    try {
      const preview = await previewInvoiceXml(emitterId, created.invoiceId, env)
      const envDigit = preview.accessKey ? preview.accessKey.charAt(23) : ''
      trace.previewXml = {
        accessKey: preview.accessKey,
        environmentDigit: envDigit,
        isValid: preview.isValid,
        errors: preview.errors,
        xmlText: preview.xml,
      }
      xmlNote = preview.isValid
        ? ' XML válido contra XSD.'
        : ` XML con ${preview.errors.length} error(es) XSD.`
      console.log(
        `📄 Preview XML (Clave: ${preview.accessKey}, Dígito 24 = '${envDigit}', Válido XSD: ${preview.isValid}):`,
        preview
      )
    } catch (previewErr: unknown) {
      xmlNote = ' (preview XML no disponible aún).'
      console.warn('⚠️ Preview XML no disponible:', previewErr)
    }

    if (mode === 'draft') {
      setLastSriEmitTrace(trace)
      console.log('🏁 Modo Borrador finalizado con éxito.')
      console.groupEnd()
      return {
        invoiceId: created.invoiceId,
        emitterId,
        mode,
        accessKey: null,
        state: created.state,
        sriTransmissionState: null,
        outcome: 'success',
        message: `Factura ${created.invoiceId.slice(0, 8)}… — total ${created.grandTotal.toFixed(2)}.${xmlNote}`,
        trace,
      }
    }

    const signed = await signInvoice(emitterId, created.invoiceId, env)
    const signEnvDigit = signed.accessKey ? signed.accessKey.charAt(23) : null
    trace.signResult = {
      accessKey: signed.accessKey,
      environmentDigit: signEnvDigit,
      state: signed.state,
      message: signed.message,
    }
    const keyHint = signed.accessKey ? ` Clave ${signed.accessKey.slice(0, 10)}…` : ''
    console.log(
      `🔏 Factura Firmada (Estado: ${signed.state}, Clave: ${signed.accessKey}, Dígito 24 = '${signEnvDigit}'):`,
      signed
    )

    if (mode === 'sign') {
      setLastSriEmitTrace(trace)
      console.log('🏁 Modo Firmar finalizado con éxito.')
      console.groupEnd()
      return {
        invoiceId: created.invoiceId,
        emitterId,
        mode,
        accessKey: signed.accessKey,
        state: signed.state,
        sriTransmissionState: signed.sriTransmissionState,
        outcome: 'success',
        message: `${signed.message} Estado ${signed.state}.${keyHint}${xmlNote}`,
        trace,
      }
    }

    // Firma encola recepción/autorización; la UI espera el resultado terminal.
    console.log('⏳ Esperando respuesta terminal del SRI...')
    const polled = await waitForSriTerminalState(emitterId, created.invoiceId, {
      timeoutMs: 90_000,
      intervalMs: 2_000,
    })

    trace.sriResult = {
      state: polled.state,
      sriTransmissionState: polled.sriTransmissionState,
      accessKey: polled.accessKey ?? signed.accessKey,
      messages: polled.messages,
    }
    console.log('🏛️ Resultado SRI Terminal:', polled)

    const outcome =
      polled.state === 'Authorized'
        ? 'success'
        : polled.state === 'Processing' || polled.state === 'Received' || polled.state === 'Signed'
          ? 'warning'
          : 'error'

    const msgSummary =
      polled.messages.length > 0
        ? polled.messages.map((m) => `[${m.identifier}] ${m.text}`).join(' | ')
        : null

    const resultLead =
      polled.state === 'Authorized'
        ? 'Factura autorizada por el SRI.'
        : polled.state === 'Returned'
          ? 'El SRI devolvió el comprobante (DEVUELTA). No se reintentará el mismo XML.'
          : polled.state === 'NotAuthorized'
            ? 'El SRI no autorizó el comprobante.'
            : polled.state === 'Processing' || polled.state === 'Received' || polled.state === 'Signed'
              ? 'Envío al SRI en curso; aún sin resultado definitivo.'
              : 'No se obtuvo un resultado definitivo del SRI a tiempo.'

    setLastSriEmitTrace(trace)
    console.log(`🏁 Fin de emisión SRI con resultado: ${outcome} (${polled.state})`)
    console.groupEnd()

    return {
      invoiceId: created.invoiceId,
      emitterId,
      mode,
      accessKey: polled.accessKey ?? signed.accessKey,
      state: polled.state,
      sriTransmissionState: polled.sriTransmissionState,
      outcome,
      message:
        outcome === 'success'
          ? 'Factura generada con éxito.'
          : [
              resultLead,
              `Estado ${polled.state}`,
              polled.sriTransmissionState ? `(transmisión ${polled.sriTransmissionState})` : null,
              msgSummary,
              `Ambiente ${env}.`,
              keyHint.trim() || null,
              xmlNote.trim() || null,
            ]
              .filter(Boolean)
              .join(' '),
      trace,
    }
  } catch (err: unknown) {
    const errorMsg = readApiError(err, 'Error en emisión de factura')
    trace.rawError = errorMsg
    setLastSriEmitTrace(trace)
    console.error('❌ [EcuNexo SRI Emisión] Error en proceso de emisión:', err)
    console.groupEnd()
    throw err
  }
}

async function waitForSriTerminalState(
  emitterId: string,
  invoiceId: string,
  opts: {
    readonly timeoutMs: number
    readonly intervalMs: number
    /** Si ya estaba en estado terminal (p. ej. Returned), no devolver hasta que cambie o expire. */
    readonly baselineState?: string | null
  }
): Promise<{
  readonly state: string
  readonly accessKey: string | null
  readonly sriTransmissionState: string | null
  readonly messages: readonly { identifier: string; text: string }[]
}> {
  const terminal = new Set(['Authorized', 'NotAuthorized', 'Returned'])
  const baseline = opts.baselineState ?? null
  const baselineIsTerminal = baseline !== null && terminal.has(baseline)
  /** Tiempo para que el worker (~5s) tome el outbox y llame al SRI. */
  const graceMs = baselineIsTerminal ? 12_000 : 0
  const started = Date.now()
  let leftBaseline = !baselineIsTerminal
  let last = await getInvoiceSriStatus(emitterId, invoiceId)

  while (Date.now() - started < opts.timeoutMs) {
    const elapsed = Date.now() - started
    if (baselineIsTerminal && elapsed >= graceMs) {
      leftBaseline = true
    }
    if (last.state === 'Authorized') {
      return mapSriStatus(last)
    }
    if (!terminal.has(last.state) || (baseline !== null && last.state !== baseline)) {
      leftBaseline = true
    }
    if (terminal.has(last.state) && leftBaseline) {
      return mapSriStatus(last)
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs))
    last = await getInvoiceSriStatus(emitterId, invoiceId)
  }

  return mapSriStatus(last)
}

function mapSriStatus(last: Awaited<ReturnType<typeof getInvoiceSriStatus>>) {
  return {
    state: last.state,
    accessKey: last.accessKey,
    sriTransmissionState: last.sriTransmissionState,
    messages: last.messages.map((m) => ({
      identifier: m.identifier,
      text: m.text,
    })),
  }
}

export type ResendInvoiceResult = {
  readonly invoiceId: string
  readonly sequentialHint: string | null
  readonly state: string
  readonly sriTransmissionState: string | null
  readonly outcome: 'success' | 'warning' | 'error'
  readonly message: string
}

/** Reencola al SRI y espera Authorized / Returned / NotAuthorized. */
export async function resendInvoiceAndWait(
  emitterId: string,
  invoiceId: string,
  opts?: {
    readonly sequentialHint?: string | null
    readonly environment?: 'Test' | 'Production' | null
  }
): Promise<ResendInvoiceResult> {
  const before = await getInvoiceSriStatus(emitterId, invoiceId)
  await retryInvoiceSri(emitterId, invoiceId, opts?.environment)

  const polled = await waitForSriTerminalState(emitterId, invoiceId, {
    timeoutMs: 90_000,
    intervalMs: 2_000,
    baselineState: before.state,
  })

  const outcome =
    polled.state === 'Authorized'
      ? 'success'
      : polled.state === 'Processing' || polled.state === 'Received' || polled.state === 'Signed'
        ? 'warning'
        : 'error'

  const msgSummary =
    polled.messages.length > 0
      ? polled.messages.map((m) => `[${m.identifier}] ${m.text}`).join(' | ')
      : null

  const seq = opts?.sequentialHint ? ` Secuencial ${opts.sequentialHint}.` : ''
  const resultLead =
    polled.state === 'Authorized'
      ? 'Factura autorizada por el SRI.'
      : polled.state === 'Returned'
        ? 'El SRI devolvió el comprobante (DEVUELTA).'
        : polled.state === 'NotAuthorized'
          ? 'El SRI no autorizó el comprobante.'
          : polled.state === 'Processing' || polled.state === 'Received' || polled.state === 'Signed'
            ? 'Reenvío en curso; aún sin resultado definitivo.'
            : 'No se obtuvo un resultado definitivo del SRI a tiempo.'

  return {
    invoiceId,
    sequentialHint: opts?.sequentialHint ?? null,
    state: polled.state,
    sriTransmissionState: polled.sriTransmissionState,
    outcome,
    message: [resultLead, `Estado ${polled.state}.`, msgSummary, seq.trim() || null]
      .filter(Boolean)
      .join(' '),
  }
}

export async function voidInvoiceAndWait(
  emitterId: string,
  invoiceId: string,
  motivo: string,
  tenantId?: string | null,
  environment?: 'Test' | 'Production' | null
): Promise<ResendInvoiceResult> {
  const created = await createCreditNote(emitterId, invoiceId, { motivo }, tenantId)
  await signInvoice(emitterId, created.creditNoteId, environment)
  const polled = await waitForSriTerminalState(emitterId, created.creditNoteId, {
    timeoutMs: 90_000,
    intervalMs: 2_000,
  })

  const outcome =
    polled.state === 'Authorized'
      ? 'success'
      : polled.state === 'Processing' || polled.state === 'Received' || polled.state === 'Signed'
        ? 'warning'
        : 'error'

  const msgSummary =
    polled.messages.length > 0
      ? polled.messages.map((m) => `[${m.identifier}] ${m.text}`).join(' | ')
      : null

  const resultLead =
    polled.state === 'Authorized'
      ? 'Nota de crédito autorizada. La factura quedó anulada.'
      : polled.state === 'Returned'
        ? 'El SRI devolvió la nota de crédito (DEVUELTA).'
        : polled.state === 'NotAuthorized'
          ? 'El SRI no autorizó la nota de crédito.'
          : polled.state === 'Processing' || polled.state === 'Received' || polled.state === 'Signed'
            ? 'Nota de crédito en curso; aún sin resultado definitivo.'
            : 'No se obtuvo un resultado definitivo del SRI a tiempo.'

  return {
    invoiceId: created.creditNoteId,
    sequentialHint: created.sequential,
    state: polled.state,
    sriTransmissionState: polled.sriTransmissionState,
    outcome,
    message: [resultLead, `NC ${created.sequential}.`, `Estado ${polled.state}.`, msgSummary]
      .filter(Boolean)
      .join(' '),
  }
}

export function readLoadError(err: unknown): string {
  return readApiError(err, 'No se pudo cargar los datos de la empresa.')
}

export function readSaveError(err: unknown): string {
  return readApiError(
    err,
    'No se pudo crear la factura en Billing.Api. ¿Está levantada en :5203?'
  )
}

export function emitToastTitle(
  mode: InvoiceEmitMode,
  outcome: SaveInvoiceResult['outcome'] = 'success'
): string {
  if (mode === 'sri') {
    if (outcome === 'success') return 'Factura autorizada por el SRI'
    if (outcome === 'warning') return 'Factura en procesamiento SRI'
    return 'SRI rechazó o no aceptó la factura'
  }
  if (mode === 'sign') return 'Factura firmada'
  return 'Borrador creado'
}

export function emitErrorTitle(mode: InvoiceEmitMode): string {
  if (mode === 'sri') return 'Error al emitir / SRI'
  if (mode === 'sign') return 'Error al firmar'
  return 'Error al guardar'
}
