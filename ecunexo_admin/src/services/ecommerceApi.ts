import { api } from '@/lib/apiClient'
import type {
  CancelEcommerceOrderBody,
  ConfirmEcommercePaymentBody,
  CreateEcommerceOrderBody,
  EcommerceOrderDetailDto,
  EcommerceOrderMetricsDto,
  EcommerceOrderPaymentProofUrlDto,
  EcommerceOrderStatus,
  EcommercePaymentStatus,
  LinkEcommerceInvoiceBody,
  ListEcommerceOrdersResponse,
  ShipEcommerceOrderBody,
  StorefrontLikeMetricsDto,
} from '@/types/ecommerceApi'

export async function listEcommerceOrders(
  tenantId: string,
  params?: {
    status?: EcommerceOrderStatus
    paymentStatus?: EcommercePaymentStatus
    search?: string
    fromDate?: string
    toDate?: string
    page?: number
    pageSize?: number
  }
): Promise<ListEcommerceOrdersResponse> {
  const { data } = await api.get<ListEcommerceOrdersResponse>(
    `/api/v1/tenants/${tenantId}/ecommerce/orders`,
    { params }
  )
  return data
}

export async function getEcommerceOrderById(
  tenantId: string,
  orderId: string
): Promise<EcommerceOrderDetailDto> {
  const { data } = await api.get<EcommerceOrderDetailDto>(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/${orderId}`
  )
  return data
}

export async function getEcommerceOrderPaymentProofUrl(
  tenantId: string,
  orderId: string
): Promise<EcommerceOrderPaymentProofUrlDto> {
  const { data } = await api.get<EcommerceOrderPaymentProofUrlDto>(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/${orderId}/payment-proof-url`
  )
  return data
}

export async function getEcommerceMetrics(
  tenantId: string,
  params?: { fromDate?: string; toDate?: string }
): Promise<EcommerceOrderMetricsDto> {
  const { data } = await api.get<EcommerceOrderMetricsDto>(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/metrics`,
    { params }
  )
  return data
}

export async function getStorefrontLikeMetrics(
  tenantId: string,
  days = 30
): Promise<StorefrontLikeMetricsDto> {
  const { data } = await api.get<StorefrontLikeMetricsDto>(
    `/api/v1/tenants/${tenantId}/ecommerce/storefront/metrics/likes`,
    { params: { days } }
  )
  return data
}

export async function createEcommerceOrder(
  tenantId: string,
  body: CreateEcommerceOrderBody
): Promise<{ orderId: string; orderNumber: string; status: number; totalAmount: number }> {
  const { data } = await api.post(
    `/api/v1/tenants/${tenantId}/ecommerce/orders`,
    body
  )
  return data
}

export async function confirmEcommerceOrderPayment(
  tenantId: string,
  orderId: string,
  body?: ConfirmEcommercePaymentBody
): Promise<{ orderId: string; status: number; paymentStatus: number }> {
  const { data } = await api.post(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/${orderId}/confirm-payment`,
    body ?? {}
  )
  return data
}

export async function processEcommerceOrder(
  tenantId: string,
  orderId: string
): Promise<{ orderId: string; status: number }> {
  const { data } = await api.post(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/${orderId}/process`,
    {}
  )
  return data
}

export async function shipEcommerceOrder(
  tenantId: string,
  orderId: string,
  body: ShipEcommerceOrderBody
): Promise<{ orderId: string; status: number; carrier: string; trackingNumber?: string | null; shippedAt?: string | null }> {
  const { data } = await api.post(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/${orderId}/ship`,
    body
  )
  return data
}

export async function deliverEcommerceOrder(
  tenantId: string,
  orderId: string
): Promise<{ orderId: string; status: number }> {
  const { data } = await api.post(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/${orderId}/deliver`,
    {}
  )
  return data
}

export async function cancelEcommerceOrder(
  tenantId: string,
  orderId: string,
  body: CancelEcommerceOrderBody
): Promise<{ orderId: string; status: number; reason: string; cancelledAt?: string | null }> {
  const { data } = await api.post(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/${orderId}/cancel`,
    body
  )
  return data
}

export async function linkEcommerceOrderInvoice(
  tenantId: string,
  orderId: string,
  body: LinkEcommerceInvoiceBody
): Promise<{ orderId: string; billingInvoiceId: string }> {
  const { data } = await api.post(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/${orderId}/link-invoice`,
    body
  )
  return data
}
