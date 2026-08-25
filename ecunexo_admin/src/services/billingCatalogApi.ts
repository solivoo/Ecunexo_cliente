import { billingApi } from '@/services/billingApi'
import { type CreateTaxRuleBody, type TaxRuleRow } from '@/pages/facturacion/taxRuleCatalog'

type CatalogWriteResponse = {
  readonly created: number
  readonly skipped: number
  readonly errors: readonly string[]
}

export async function listTaxRules(): Promise<readonly TaxRuleRow[]> {
  const { data } = await billingApi.get<readonly TaxRuleRow[]>('/api/v1/catalogs/tax-rules')
  return data
}

export async function createTaxRule(body: CreateTaxRuleBody): Promise<CatalogWriteResponse> {
  const { data } = await billingApi.post<CatalogWriteResponse>('/api/v1/catalogs/tax-rules', body)
  return data
}
