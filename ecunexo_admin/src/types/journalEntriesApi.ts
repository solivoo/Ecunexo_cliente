export type JournalEntryStatusKind = 'Draft' | 'Posted' | 'Cancelled'
export type JournalEntrySourceKind =
  | 'Manual'
  | 'SalesInvoice'
  | 'PurchaseInvoice'
  | 'PurchaseSettlement'
  | 'InventoryReceipt'
  | 'InventoryDispatch'
  | 'PaymentReceipt'
  | 'SupplierPayment'

export interface JournalEntryLineDto {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  reference?: string | null
}

export interface JournalEntrySummaryDto {
  id: string
  tenantId: string
  entryNumber: string
  date: string
  description: string
  status: JournalEntryStatusKind | number
  source: JournalEntrySourceKind | number
  sourceId?: string | null
  sourceReference?: string | null
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  linesCount: number
  createdAt: string
}

export interface ListJournalEntriesKpisDto {
  totalEntries: number
  totalPosted: number
  totalDraft: number
  totalDebitVolume: number
}

export interface ListJournalEntriesResponse {
  kpis: ListJournalEntriesKpisDto
  entries: JournalEntrySummaryDto[]
}

export interface JournalEntryDto {
  id: string
  tenantId: string
  entryNumber: string
  date: string
  description: string
  status: JournalEntryStatusKind | number
  source: JournalEntrySourceKind | number
  sourceId?: string | null
  sourceReference?: string | null
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  createdAt: string
  updatedAt?: string | null
  lines: JournalEntryLineDto[]
}

export interface CreateJournalEntryLineInput {
  accountId: string
  debit: number
  credit: number
  description?: string
}

export interface CreateJournalEntryPayload {
  date: string
  description: string
  lines: CreateJournalEntryLineInput[]
  autoPost?: boolean
}

export interface JournalEntryFilterParams {
  from?: string
  to?: string
  status?: number
  source?: number
  search?: string
}
