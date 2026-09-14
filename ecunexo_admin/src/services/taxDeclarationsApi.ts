import { api } from '@/lib/apiClient'
import type { MonthlyTaxDeclarationResponse } from '@/types/taxDeclarationsApi'

export async function getMonthlyTaxDeclaration(
  tenantId: string,
  year: number,
  month: number
): Promise<MonthlyTaxDeclarationResponse> {
  const { data } = await api.get<MonthlyTaxDeclarationResponse>(
    `/api/v1/tenants/${tenantId}/accounting/tax-declarations/monthly`,
    {
      params: { year, month },
    }
  )
  return data
}
