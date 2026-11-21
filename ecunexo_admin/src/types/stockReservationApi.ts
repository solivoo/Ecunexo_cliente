export type StockReservationStatus = 1 | 2 | 3 | 4 | 5

export interface StockReservationItemDto {
  id: string
  catalogItemId: string
  sku: string
  itemName: string
  quantity: number
  unitPrice: number
  taxRate: number
  lineSubtotal: number
  lineTax: number
  lineTotal: number
}

export interface StockReservationPaymentDto {
  id: string
  amount: number
  paymentMethod: number
  reference: string | null
  notes: string | null
  hasProof: boolean
  proofContentType: string | null
  paidAtUtc: string
}

export interface StockReservationDto {
  id: string
  reservationNumber: string
  warehouseId: string
  warehouseName: string
  customerId: string
  customerName: string
  customerTaxId: string
  customerEmail: string | null
  customerPhone: string | null
  status: StockReservationStatus
  reservedAtUtc: string
  expiresAtUtc: string | null
  subtotal: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  isFullyPaid: boolean
  billingInvoiceId: string | null
  invoiceObservation: string | null
  notes: string | null
  invoicedAtUtc: string | null
  cancelledAtUtc: string | null
  cancellationReason: string | null
  items: StockReservationItemDto[]
  payments: StockReservationPaymentDto[]
}

export interface CreateReservationCustomerBody {
  name: string
  taxId?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  identificationType?: number
}

export interface CreateReservationItemBody {
  catalogItemId: string
  quantity: number
  unitPrice?: number | null
  taxRate?: number | null
}

export interface CreateStockReservationBody {
  warehouseId: string
  customerId?: string | null
  newCustomer?: CreateReservationCustomerBody | null
  items: CreateReservationItemBody[]
  expiresAtUtc?: string | null
  notes?: string | null
}
