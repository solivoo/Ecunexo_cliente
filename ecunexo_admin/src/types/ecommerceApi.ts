export const EcommerceOrderStatus = {
  Placed: 0,
  Confirmed: 1,
  Processing: 2,
  Shipped: 3,
  Delivered: 4,
  Cancelled: 5,
  Refunded: 6,
} as const

export type EcommerceOrderStatus = (typeof EcommerceOrderStatus)[keyof typeof EcommerceOrderStatus]

export const EcommercePaymentStatus = {
  Pending: 0,
  Authorized: 1,
  Paid: 2,
  Failed: 3,
  Refunded: 4,
} as const

export type EcommercePaymentStatus = (typeof EcommercePaymentStatus)[keyof typeof EcommercePaymentStatus]

export const EcommercePaymentMethod = {
  CreditCard: 1,
  BankTransfer: 2,
  CashOnDelivery: 3,
  PaymentGateway: 4,
  Other: 99,
} as const

export type EcommercePaymentMethod = (typeof EcommercePaymentMethod)[keyof typeof EcommercePaymentMethod]

export const EcommerceShippingMethod = {
  Courier: 1,
  StorePickup: 2,
  LocalDelivery: 3,
} as const

export type EcommerceShippingMethod = (typeof EcommerceShippingMethod)[keyof typeof EcommerceShippingMethod]

export function ecommerceOrderStatusLabel(status: EcommerceOrderStatus | number): string {
  switch (status) {
    case EcommerceOrderStatus.Placed:
      return 'Recibido (Stock Reservado)'
    case EcommerceOrderStatus.Confirmed:
      return 'Confirmado'
    case EcommerceOrderStatus.Processing:
      return 'En Preparación'
    case EcommerceOrderStatus.Shipped:
      return 'Despachado / En Ruta'
    case EcommerceOrderStatus.Delivered:
      return 'Entregado'
    case EcommerceOrderStatus.Cancelled:
      return 'Cancelado'
    case EcommerceOrderStatus.Refunded:
      return 'Reembolsado'
    default:
      return 'Desconocido'
  }
}

export function ecommerceOrderStatusBadgeTone(
  status: EcommerceOrderStatus | number
): 'neutral' | 'info' | 'primary' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case EcommerceOrderStatus.Placed:
      return 'warning'
    case EcommerceOrderStatus.Confirmed:
      return 'info'
    case EcommerceOrderStatus.Processing:
      return 'primary'
    case EcommerceOrderStatus.Shipped:
      return 'info'
    case EcommerceOrderStatus.Delivered:
      return 'success'
    case EcommerceOrderStatus.Cancelled:
      return 'danger'
    case EcommerceOrderStatus.Refunded:
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function ecommercePaymentStatusLabel(status: EcommercePaymentStatus | number): string {
  switch (status) {
    case EcommercePaymentStatus.Pending:
      return 'Pendiente'
    case EcommercePaymentStatus.Authorized:
      return 'Autorizado'
    case EcommercePaymentStatus.Paid:
      return 'Pagado'
    case EcommercePaymentStatus.Failed:
      return 'Fallido'
    case EcommercePaymentStatus.Refunded:
      return 'Reembolsado'
    default:
      return 'Desconocido'
  }
}

export function ecommercePaymentMethodLabel(method: EcommercePaymentMethod | number): string {
  switch (method) {
    case EcommercePaymentMethod.CreditCard:
      return 'Tarjeta de Crédito/Débito'
    case EcommercePaymentMethod.BankTransfer:
      return 'Transferencia / Depósito'
    case EcommercePaymentMethod.CashOnDelivery:
      return 'Contra Entrega (Efectivo)'
    case EcommercePaymentMethod.PaymentGateway:
      return 'Pasarela Online'
    case EcommercePaymentMethod.Other:
    default:
      return 'Otro'
  }
}

export function ecommerceShippingMethodLabel(method: EcommerceShippingMethod | number): string {
  switch (method) {
    case EcommerceShippingMethod.Courier:
      return 'Courier (Servientrega/Urbano)'
    case EcommerceShippingMethod.StorePickup:
      return 'Retiro en Tienda'
    case EcommerceShippingMethod.LocalDelivery:
      return 'Entrega Express Motorizada'
    default:
      return 'Envío Estándar'
  }
}

export interface EcommerceCustomerDto {
  customerName: string
  taxId: string
  taxIdType?: string | null
  email: string
  phone?: string | null
  address?: string | null
}

export interface EcommerceShippingDto {
  recipientName: string
  recipientPhone?: string | null
  addressLine1: string
  addressLine2?: string | null
  city: string
  province?: string | null
  postalCode?: string | null
  carrier?: string | null
  trackingNumber?: string | null
  notes?: string | null
}

export interface EcommerceOrderItemDto {
  id: string
  catalogItemId: string
  sku: string
  itemName: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
}

export interface EcommerceOrderTimelineDto {
  id: string
  previousStatus?: EcommerceOrderStatus | null
  newStatus: EcommerceOrderStatus
  notes?: string | null
  occurredAt: string
  userId?: string | null
  userName?: string | null
}

export interface EcommerceOrderSummaryDto {
  id: string
  orderNumber: string
  warehouseId: string
  warehouseName?: string | null
  orderDate: string
  status: EcommerceOrderStatus
  paymentStatus: EcommercePaymentStatus
  paymentMethod: EcommercePaymentMethod
  paymentReference?: string | null
  shippingMethod: EcommerceShippingMethod
  customerName: string
  customerTaxId: string
  customerEmail: string
  recipientCity: string
  totalAmount: number
  itemsCount: number
  billingInvoiceId?: string | null
  createdAt: string
}

export interface EcommerceOrderDetailDto {
  id: string
  tenantId: string
  orderNumber: string
  warehouseId: string
  warehouseName?: string | null
  orderDate: string
  status: EcommerceOrderStatus
  paymentStatus: EcommercePaymentStatus
  paymentMethod: EcommercePaymentMethod
  paymentReference?: string | null
  shippingMethod: EcommerceShippingMethod
  customer: EcommerceCustomerDto
  shipping: EcommerceShippingDto
  subtotal: number
  discountAmount: number
  taxAmount: number
  shippingCost: number
  totalAmount: number
  billingInvoiceId?: string | null
  estimatedDeliveryDate?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  cancelledAt?: string | null
  cancellationReason?: string | null
  internalNotes?: string | null
  customerNotes?: string | null
  createdAt: string
  items: EcommerceOrderItemDto[]
  timeline: EcommerceOrderTimelineDto[]
}

export interface EcommerceOrderMetricsDto {
  totalOrders: number
  pendingCount: number
  processingCount: number
  shippedCount: number
  deliveredCount: number
  cancelledCount: number
  totalSalesAmount: number
}

export interface ListEcommerceOrdersResponse {
  items: EcommerceOrderSummaryDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface CreateEcommerceOrderItemBody {
  catalogItemId: string
  quantity: number
  unitPrice: number
  discountAmount?: number
  taxRate?: number
}

export interface CreateEcommerceOrderBody {
  warehouseId: string
  paymentMethod: EcommercePaymentMethod
  shippingMethod: EcommerceShippingMethod
  customer: EcommerceCustomerDto
  shipping: EcommerceShippingDto
  items: CreateEcommerceOrderItemBody[]
  shippingCost?: number
  internalNotes?: string | null
  customerNotes?: string | null
}

export interface ShipEcommerceOrderBody {
  carrier: string
  trackingNumber?: string | null
}

export interface CancelEcommerceOrderBody {
  reason: string
}

export interface ConfirmEcommercePaymentBody {
  paymentReference?: string | null
}

export interface LinkEcommerceInvoiceBody {
  billingInvoiceId: string
}
