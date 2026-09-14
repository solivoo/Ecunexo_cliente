import { api } from '@/lib/apiClient'
import type { FinancialStatementsResponse } from '@/types/financialStatementsApi'

export async function getFinancialStatements(
  tenantId: string,
  year: number,
  month: number
): Promise<FinancialStatementsResponse> {
  const { data } = await api.get<FinancialStatementsResponse>(
    `/api/v1/tenants/${tenantId}/accounting/financial-statements`,
    {
      params: { year, month },
    }
  )
  return data
}
