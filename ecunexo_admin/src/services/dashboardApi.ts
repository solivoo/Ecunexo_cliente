import { api } from '@/lib/apiClient'

export interface SalesMonthlyTrendDto {
  mes: string
  ventas: number
  comprobantes: number
}

export interface StatusDistributionDto {
  name: string
  value: number
  color?: string
}

export interface CustomerTypeDistributionDto {
  tipo: string
  cantidad: number
}

export interface PurchasesExpensesTrendDto {
  mes: string
  inventario: number
  servicios: number
}

export interface WarehouseStockDistributionDto {
  bodega: string
  stockFisico: number
  stockMinimo: number
}

export interface FinancialBalanceDto {
  rubro: string
  monto: number
}

export interface TaxDeclarationTrendDto {
  mes: string
  ivacobrado: number
  ivasoportado: number
  retenciones: number
}

export interface DashboardAnalyticsResponseDto {
  salesMonthlyTrend: SalesMonthlyTrendDto[]
  sriStatusDistribution: StatusDistributionDto[]
  customerTypeDistribution: CustomerTypeDistributionDto[]
  purchasesExpensesTrend: PurchasesExpensesTrendDto[]
  warehouseStockDistribution: WarehouseStockDistributionDto[]
  remisionGuidesStatus: StatusDistributionDto[]
  repairStagesDistribution: StatusDistributionDto[]
  financialBalance: FinancialBalanceDto[]
  taxDeclarationsTrend: TaxDeclarationTrendDto[]
}

export async function getDashboardAnalytics(tenantId: string): Promise<DashboardAnalyticsResponseDto> {
  const { data } = await api.get<DashboardAnalyticsResponseDto>(
    `/api/v1/tenants/${tenantId}/dashboard/analytics`
  )
  return data
}
