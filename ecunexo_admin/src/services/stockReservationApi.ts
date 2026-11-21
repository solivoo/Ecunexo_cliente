import { api } from '@/lib/apiClient'
import type {
  CreateStockReservationBody,
  StockReservationDto,
  StockReservationStatus,
} from '@/types/stockReservationApi'

const base = (tenantId: string) => `/api/v1/tenants/${tenantId}/ecommerce/reservations`

export async function listStockReservations(
  tenantId: string,
  params?: { status?: StockReservationStatus; search?: string }
): Promise<StockReservationDto[]> {
  const { data } = await api.get<StockReservationDto[]>(base(tenantId), { params })
  return data
}

export async function getStockReservationById(
  tenantId: string,
  reservationId: string
): Promise<StockReservationDto> {
  const { data } = await api.get<StockReservationDto>(`${base(tenantId)}/${reservationId}`)
  return data
}

export async function createStockReservation(
  tenantId: string,
  body: CreateStockReservationBody
): Promise<StockReservationDto> {
  const { data } = await api.post<StockReservationDto>(base(tenantId), body)
  return data
}

export async function addStockReservationPayment(
  tenantId: string,
  reservationId: string,
  payload: {
    amount: number
    paymentMethod: number
    reference?: string
    notes?: string
    file?: File | null
  }
): Promise<StockReservationDto> {
  const form = new FormData()
  form.append('amount', String(payload.amount))
  form.append('paymentMethod', String(payload.paymentMethod))
  if (payload.reference?.trim()) form.append('reference', payload.reference.trim())
  if (payload.notes?.trim()) form.append('notes', payload.notes.trim())
  if (payload.file) form.append('file', payload.file)

  const { data } = await api.post<StockReservationDto>(
    `${base(tenantId)}/${reservationId}/payments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data
}

export async function getStockReservationPaymentProofUrl(
  tenantId: string,
  reservationId: string,
  paymentId: string
): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>(
    `${base(tenantId)}/${reservationId}/payments/${paymentId}/proof-url`
  )
  return data
}

export async function cancelStockReservation(
  tenantId: string,
  reservationId: string,
  reason?: string
): Promise<StockReservationDto> {
  const { data } = await api.post<StockReservationDto>(
    `${base(tenantId)}/${reservationId}/cancel`,
    { reason: reason?.trim() || null }
  )
  return data
}

export async function invoiceStockReservation(
  tenantId: string,
  reservationId: string,
  body: { billingInvoiceId: string; observation?: string | null }
): Promise<StockReservationDto> {
  const { data } = await api.post<StockReservationDto>(
    `${base(tenantId)}/${reservationId}/invoice`,
    body
  )
  return data
}
