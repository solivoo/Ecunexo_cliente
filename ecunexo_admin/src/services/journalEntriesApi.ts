import { api } from '@/lib/apiClient'
import type {
  JournalEntryDto,
  JournalEntryFilterParams,
  ListJournalEntriesResponse,
  CreateJournalEntryPayload,
} from '@/types/journalEntriesApi'

export async function listJournalEntries(
  tenantId: string,
  params?: JournalEntryFilterParams
): Promise<ListJournalEntriesResponse> {
  const queryParams: Record<string, string> = {}
  if (params?.search?.trim()) {
    queryParams.search = params.search.trim()
  }
  if (params?.from) {
    queryParams.from = params.from
  }
  if (params?.to) {
    queryParams.to = params.to
  }
  if (params?.status !== undefined) {
    queryParams.status = String(params.status)
  }
  if (params?.source !== undefined) {
    queryParams.source = String(params.source)
  }

  const { data } = await api.get<ListJournalEntriesResponse>(
    `/api/v1/tenants/${tenantId}/accounting/journal-entries`,
    { params: queryParams }
  )
  return data
}

export async function getJournalEntryById(
  tenantId: string,
  id: string
): Promise<JournalEntryDto> {
  const { data } = await api.get<JournalEntryDto>(
    `/api/v1/tenants/${tenantId}/accounting/journal-entries/${id}`
  )
  return data
}

export async function createManualJournalEntry(
  tenantId: string,
  payload: CreateJournalEntryPayload
): Promise<JournalEntryDto> {
  const { data } = await api.post<JournalEntryDto>(
    `/api/v1/tenants/${tenantId}/accounting/journal-entries`,
    payload
  )
  return data
}

export async function generateJournalEntryFromPurchase(
  tenantId: string,
  purchaseId: string
): Promise<JournalEntryDto> {
  const { data } = await api.post<JournalEntryDto>(
    `/api/v1/tenants/${tenantId}/accounting/journal-entries/generate-from-purchase/${purchaseId}`
  )
  return data
}
