import axios from 'axios'
import { store } from '@/store'
import type {
  CreateCreditNoteBody,
  CreateCreditNoteResponse,
  CreateEmitterBody,
  CreateEmitterResponse,
  CreateInvoiceBody,
  CreateInvoiceResponse,
  InvoiceActionResponse,
  InvoiceDetail,
  InvoiceListResponse,
  InvoiceStateResponse,
  InvoiceXmlDownload,
  PreviewXmlResponse,
  RideProviderSettings,
  SequentialNextResponse,
  SetSequentialNextBody,
  UpdateRideProviderBody,
} from '@/types/billingApi'

const billingBaseUrl = () =>
  import.meta.env.VITE_BILLING_API_BASE_URL?.trim() || 'http://localhost:5203'

export const billingApi = axios.create({
  baseURL: billingBaseUrl(),
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
})

const INVOICE_READ_ALL = 'facturacion.facturas.read.all'

billingApi.interceptors.request.use((config) => {
  const { tenantId, userId, permissions } = store.getState().auth
  if (tenantId && !config.headers['X-Tenant-Id']) {
    config.headers['X-Tenant-Id'] = tenantId
  }
  if (userId && !config.headers['X-User-Id']) {
    config.headers['X-User-Id'] = userId
  }
  if (
    !config.headers['X-Invoice-Read-Scope'] &&
    permissions.some((p) => p.toLowerCase() === INVOICE_READ_ALL)
  ) {
    config.headers['X-Invoice-Read-Scope'] = 'all'
  }
  return config
})

export async function createEmitter(
  body: CreateEmitterBody,
  tenantId?: string | null
): Promise<CreateEmitterResponse> {
  const { data } = await billingApi.post<CreateEmitterResponse>('/api/v1/emitters', body, {
    headers: tenantId ? { 'X-Tenant-Id': tenantId } : undefined,
  })
  return data
}

export async function peekNextSequential(
  emitterId: string,
  params?: {
    readonly establishment?: string
    readonly emissionPoint?: string
  }
): Promise<SequentialNextResponse> {
  const { data } = await billingApi.get<SequentialNextResponse>(
    `/api/v1/emitters/${emitterId}/sequential-next`,
    { params }
  )
  return data
}

export async function setNextSequential(
  emitterId: string,
  body: SetSequentialNextBody
): Promise<SequentialNextResponse> {
  const { data } = await billingApi.put<SequentialNextResponse>(
    `/api/v1/emitters/${emitterId}/sequential-next`,
    body
  )
  return data
}

export async function createInvoice(
  emitterId: string,
  body: CreateInvoiceBody,
  tenantId?: string | null
): Promise<CreateInvoiceResponse> {
  const { data } = await billingApi.post<CreateInvoiceResponse>(
    `/api/v1/emitters/${emitterId}/invoices`,
    body,
    { headers: tenantId ? { 'X-Tenant-Id': tenantId } : undefined }
  )
  return data
}

export async function previewInvoiceXml(
  emitterId: string,
  invoiceId: string
): Promise<PreviewXmlResponse> {
  const { data } = await billingApi.post<PreviewXmlResponse>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}/preview-xml`
  )
  return data
}

export async function createCreditNote(
  emitterId: string,
  invoiceId: string,
  body: CreateCreditNoteBody,
  tenantId?: string | null
): Promise<CreateCreditNoteResponse> {
  const { data } = await billingApi.post<CreateCreditNoteResponse>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}/credit-notes`,
    body,
    { headers: tenantId ? { 'X-Tenant-Id': tenantId } : undefined }
  )
  return data
}

export async function signInvoice(
  emitterId: string,
  invoiceId: string
): Promise<InvoiceActionResponse> {
  const { data } = await billingApi.post<InvoiceActionResponse>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}/sign`
  )
  return data
}

export async function submitInvoiceReception(
  emitterId: string,
  invoiceId: string,
  environment?: 'Test' | 'Production' | null
): Promise<InvoiceActionResponse> {
  const { data } = await billingApi.post<InvoiceActionResponse>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}/submit-reception`,
    null,
    { params: environment ? { environment } : undefined }
  )
  return data
}

export async function pollInvoiceAuthorization(
  emitterId: string,
  invoiceId: string,
  environment?: 'Test' | 'Production' | null
): Promise<InvoiceActionResponse> {
  const { data } = await billingApi.post<InvoiceActionResponse>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}/authorize-poll`,
    null,
    { params: environment ? { environment } : undefined }
  )
  return data
}

export async function getInvoiceSriStatus(
  emitterId: string,
  invoiceId: string
): Promise<InvoiceStateResponse> {
  const { data } = await billingApi.get<InvoiceStateResponse>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}/sri-status`
  )
  return data
}

export async function listInvoices(
  emitterId: string,
  params?: {
    readonly from?: string
    readonly to?: string
    readonly state?: string
    readonly page?: number
    readonly pageSize?: number
  }
): Promise<InvoiceListResponse> {
  const { data } = await billingApi.get<InvoiceListResponse>(
    `/api/v1/emitters/${emitterId}/invoices`,
    { params }
  )
  return data
}

export async function getInvoiceDetail(
  emitterId: string,
  invoiceId: string
): Promise<InvoiceDetail> {
  const { data } = await billingApi.get<InvoiceDetail>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}`
  )
  return data
}

export async function getInvoiceXml(
  emitterId: string,
  invoiceId: string
): Promise<InvoiceXmlDownload> {
  const { data } = await billingApi.get<InvoiceXmlDownload>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}/xml`
  )
  return data
}

export async function retryInvoiceSri(
  emitterId: string,
  invoiceId: string
): Promise<InvoiceActionResponse> {
  const { data } = await billingApi.post<InvoiceActionResponse>(
    `/api/v1/emitters/${emitterId}/invoices/${invoiceId}/sri/retry`
  )
  return data
}

export async function getRideProvider(): Promise<RideProviderSettings> {
  const { data } = await billingApi.get<RideProviderSettings>('/api/v1/ride-provider')
  return data
}

export async function updateRideProvider(
  body: UpdateRideProviderBody
): Promise<RideProviderSettings> {
  const { data } = await billingApi.put<RideProviderSettings>('/api/v1/ride-provider', body)
  return data
}
