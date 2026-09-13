export type SupplierIdentificationType = 1 | 2 | 3 // 1: RUC, 2: Cédula, 3: Pasaporte
export type SupplierTaxRegime = 1 | 2 | 3 | 4 | 5 // 1: General, 2: Rimpe Emprendedor, 3: Rimpe Negocio Popular, 4: Contribuyente Especial, 5: Entidad Pública
export type PurchaseProformaStatus = 1 | 2 | 3 | 4 | 5 // 1: Draft, 2: Approved, 3: ConvertedToPurchase, 4: Rejected, 5: Expired

export interface SupplierDto {
  id: string
  tenantId: string
  businessName: string
  tradeName: string | null
  identificationType: SupplierIdentificationType
  taxId: string
  taxRegime: SupplierTaxRegime
  isRetentionAgent: boolean
  resolutionNumber: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  contactPerson: string | null
  creditDays: number
  creditLimit: number | null
  bankName: string | null
  bankAccountType: string | null
  bankAccountNumber: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateSupplierPayload {
  businessName: string
  taxId: string
  identificationType?: SupplierIdentificationType
  taxRegime?: SupplierTaxRegime
  tradeName?: string | null
  isRetentionAgent?: boolean
  resolutionNumber?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  contactPerson?: string | null
  creditDays?: number
  creditLimit?: number | null
  bankName?: string | null
  bankAccountType?: string | null
  bankAccountNumber?: string | null
  notes?: string | null
}

export interface UpdateSupplierPayload extends CreateSupplierPayload {
  isActive: boolean
}

export interface SupplierFilterParams {
  search?: string
  activeOnly?: boolean
}

export interface ExpenseTypeDto {
  id: string
  tenantId: string
  code: string
  name: string
  sriSustentoCode: string
  description: string | null
  affectsInventory: boolean
  isSystem: boolean
  suggestedRetentionCode: string | null
  retentionPercentage: number | null
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateExpenseTypePayload {
  code: string
  name: string
  sriSustentoCode?: string
  affectsInventory?: boolean
  suggestedRetentionCode?: string | null
  retentionPercentage?: number | null
  validFrom?: string | null
  validUntil?: string | null
  description?: string | null
}

export interface UpdateExpenseTypePayload {
  name: string
  sriSustentoCode?: string
  affectsInventory?: boolean
  suggestedRetentionCode?: string | null
  retentionPercentage?: number | null
  validFrom?: string | null
  validUntil?: string | null
  description?: string | null
  code?: string
  isActive?: boolean
}

export interface PurchaseProformaItemDto {
  id: string
  catalogItemId: string | null
  expenseTypeId: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  lineTotal: number
}

export interface PurchaseProformaDto {
  id: string
  tenantId: string
  supplierId: string
  supplierBusinessName: string | null
  proformaNumber: string
  issueDate: string
  expirationDate: string | null
  notes: string | null
  status: PurchaseProformaStatus
  currency: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  attachmentUrl: string | null
  attachmentFileName: string | null
  convertedPurchaseId: string | null
  createdAt: string
  updatedAt: string | null
  items: PurchaseProformaItemDto[]
}

export interface CreatePurchaseProformaItemPayload {
  description: string
  quantity: number
  unitPrice: number
  taxRate?: number
  catalogItemId?: string | null
  expenseTypeId?: string | null
}

export interface CreatePurchaseProformaPayload {
  supplierId: string
  proformaNumber: string
  issueDate: string
  expirationDate?: string | null
  notes?: string | null
  attachmentUrl?: string | null
  attachmentFileName?: string | null
  subtotal?: number
  taxAmount?: number
  totalAmount?: number
  items?: CreatePurchaseProformaItemPayload[]
}

export interface PurchaseProformaFilterParams {
  supplierId?: string
  status?: PurchaseProformaStatus
  from?: string
  to?: string
}

// ======================== FACTURAS DE COMPRA (SRI 01) ========================

export type PurchaseStatus = 1 | 2 | 3 | 4 // 1: Draft, 2: Received, 3: Invoiced, 4: Cancelled

export interface PurchaseItemDto {
  id: string
  purchaseId: string
  catalogItemId: string | null
  warehouseId: string | null
  itemCode: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  affectsInventory: boolean
}

export interface PurchaseSummaryDto {
  id: string
  tenantId: string
  supplierId: string
  supplierBusinessName: string
  supplierTaxId: string
  documentType: string
  invoiceNumber: string
  authorizationNumber: string | null
  issueDate: string
  sriSustentoCode: string
  subtotalZero: number
  subtotalTaxed: number
  taxRate: number
  taxAmount: number
  totalDiscount: number
  totalAmount: number
  status: PurchaseStatus
  inventoryDocumentId: string | null
  itemsCount: number
  createdAt: string
}

export interface ListPurchasesKpisDto {
  totalPurchases: number
  totalReceived: number
  totalDraft: number
  totalBilledAmount: number
}

export interface ListPurchasesResponse {
  kpis: ListPurchasesKpisDto
  purchases: PurchaseSummaryDto[]
}

export interface PurchaseDetailDto extends PurchaseSummaryDto {
  subtotalNoSubject: number
  subtotalExempt: number
  paymentMethodCode: string | null
  creditDays: number
  expenseTypeId: string | null
  expenseTypeName: string | null
  proformaId: string | null
  rawXml: string | null
  notes: string | null
  items: PurchaseItemDto[]
}

export interface DetectedSupplierDto {
  existingSupplierId: string | null
  taxId: string
  businessName: string
  tradeName: string | null
  address: string | null
  isRegistered: boolean
}

export interface ParsedLineWithMatchDto {
  itemCode: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  matchedCatalogItemId: string | null
  matchedCatalogItemName: string | null
  canAffectInventory: boolean
  assignedWarehouseId?: string | null
}

export interface SriValidationAlertDto {
  severity: 'success' | 'warning' | 'danger' | 'info'
  code: string
  title: string
  message: string
  recommendation?: string | null
}

export interface SriValidationReportDto {
  overallStatus: 'valid' | 'warning' | 'danger'
  isAuthorizedBySri: boolean
  sriStatus?: string | null
  sriAuthorizationDate?: string | null
  environment: string
  isAccessKeyValid: boolean
  accessKeyCheckDigitExpected?: string | null
  isMathConsistent: boolean
  calculatedTotal: number
  declaredTotal: number
  mathDiscrepancy: number
  taxRateStatus: string
  alerts: SriValidationAlertDto[]
}

export interface ParseSriPurchaseXmlResponse {
  supplier: DetectedSupplierDto
  invoiceNumber: string
  authorizationNumber: string
  issueDate: string
  documentType: string
  subtotalZero: number
  subtotalTaxed: number
  subtotalNoSubject: number
  subtotalExempt: number
  taxRate: number
  taxAmount: number
  totalDiscount: number
  totalAmount: number
  paymentMethodCode: string | null
  creditDays: number
  lines: ParsedLineWithMatchDto[]
  rawXml: string
  validationReport?: SriValidationReportDto | null
}

export interface CreatePurchaseItemPayload {
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  taxRate?: number
  itemCode?: string | null
  catalogItemId?: string | null
  warehouseId?: string | null
  affectsInventory?: boolean
}

export interface CreatePurchasePayload {
  supplierId: string
  invoiceNumber: string
  issueDate: string
  documentType?: string
  authorizationNumber?: string | null
  expenseTypeId?: string | null
  sriSustentoCode?: string
  subtotalZero?: number
  subtotalTaxed?: number
  subtotalNoSubject?: number
  subtotalExempt?: number
  taxRate?: number
  taxAmount?: number
  totalDiscount?: number
  totalAmount?: number
  paymentMethodCode?: string | null
  creditDays?: number
  proformaId?: string | null
  rawXml?: string | null
  notes?: string | null
  items?: CreatePurchaseItemPayload[]
}

export interface ReceivePurchaseLineMappingPayload {
  lineId: string
  catalogItemId: string
  warehouseId: string
}

export interface ReceivePurchasePayload {
  defaultWarehouseId?: string | null
  lineMappings?: ReceivePurchaseLineMappingPayload[]
}

export interface PurchaseFilterParams {
  supplierId?: string
  status?: PurchaseStatus
  from?: string
  to?: string
  search?: string
}

