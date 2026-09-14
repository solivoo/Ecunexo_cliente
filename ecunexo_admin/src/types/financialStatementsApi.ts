export interface FinancialAccountLineDto {
  code: string
  name: string
  level: number
  balance: number
  nature: string
}

export interface BalanceSheetGroupDto {
  groupCode: string
  groupName: string
  total: number
  accounts: FinancialAccountLineDto[]
}

export interface BalanceSheetDto {
  activoCorriente: BalanceSheetGroupDto[]
  totalActivoCorriente: number
  activoNoCorriente: BalanceSheetGroupDto[]
  totalActivoNoCorriente: number
  totalActivos: number
  pasivoCorriente: BalanceSheetGroupDto[]
  totalPasivoCorriente: number
  pasivoNoCorriente: BalanceSheetGroupDto[]
  totalPasivoNoCorriente: number
  totalPasivos: number
  patrimonio: BalanceSheetGroupDto[]
  totalPatrimonioSinUtilidad: number
  utilidadDelEjercicio: number
  totalPatrimonioNeto: number
  totalPasivoYPatrimonio: number
  diferenciaCuadre: number
  estaEquilibrado: boolean
}

export interface IncomeStatementGroupDto {
  concept: string
  accountCode: string
  amount: number
  details: FinancialAccountLineDto[]
}

export interface IncomeStatementDto {
  ventasNetasTarifa15: number
  ventasNetasTarifa0: number
  totalIngresosOperacionales: number
  costoDeVentas: number
  utilidadBruta: number
  gastosAdministracion: number
  gastosVentasYMarketing: number
  totalGastosOperacionales: number
  utilidadOperativa: number
  participacionTrabajadores15: number
  utilidadAntesDeImpuestos: number
  impuestoRentaEstimado25: number
  utilidadNetaEjercicio: number
  desgloseGastos: IncomeStatementGroupDto[]
}

export interface FinancialStatementsResponse {
  tenantId: string
  year: number
  month: number
  periodName: string
  cutoffDate: string
  balanceGeneral: BalanceSheetDto
  estadoResultados: IncomeStatementDto
}
