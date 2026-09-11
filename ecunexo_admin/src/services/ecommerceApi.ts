import { api } from '@/lib/apiClient'
import type {
  CancelEcommerceOrderBody,
  ConfirmEcommercePaymentBody,
  CreateEcommerceOrderBody,
  EcommerceOrderDetailDto,
  EcommerceOrderMetricsDto,
  EcommerceOrderStatus,
  EcommercePaymentStatus,
  LinkEcommerceInvoiceBody,
  ListEcommerceOrdersResponse,
  ShipEcommerceOrderBody,
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

export async function getEcommerceMetrics(
  tenantId: string
): Promise<EcommerceOrderMetricsDto> {
  const { data } = await api.get<EcommerceOrderMetricsDto>(
    `/api/v1/tenants/${tenantId}/ecommerce/orders/metrics`
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
