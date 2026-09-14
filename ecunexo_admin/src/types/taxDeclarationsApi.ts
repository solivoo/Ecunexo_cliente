export interface F104VentasSummaryDto {
  casillero401BaseGravada: number
  casillero411IvaGenerado: number
  casillero403BaseTarifaCero: number
  casillero429TotalVentas: number
  casillero499TotalImpuestoGenerado: number
}

export interface F104ComprasSummaryDto {
  casillero500BaseGravada: number
  casillero510IvaPagado: number
  casillero507BaseTarifaCero: number
  casillero529TotalAdquisiciones: number
  casillero564FactorProporcionalidad: number
  casillero569CreditoTributarioAplicable: number
}

export interface F104LiquidacionSummaryDto {
  casillero601ImpuestoCausado: number
  casillero609RetencionesIvaRecibidas: number
  casillero615CreditoTributarioMesSiguiente: number
  saldoNetoAPagar: number
  generaImpuestoAPagar: boolean
}

export interface F104FormularioIvaDto {
  ventas: F104VentasSummaryDto
  compras: F104ComprasSummaryDto
  liquidacion: F104LiquidacionSummaryDto
}

export interface F103RetencionLineaDto {
  codigoRetencion: string
  descripcion: string
  porcentaje: number
  baseImponible: number
  montoRetenido: number
}

export interface F103FormularioRetencionesDto {
  lineas: F103RetencionLineaDto[]
  totalBaseImponible: number
  totalRetenidoAPagar: number
}

export interface ConciliacionSasDto {
  totalFacturasCompra: number
  totalLiquidacionesCompra: number
  totalAsientosContabilizados: number
  totalVentasNetas: number
  totalComprasNetas: number
  margenBrutoOperativo: number
  flujoTributarioNetoEstimado: number
  todoCuadradoNIIF: boolean
}

export interface MonthlyTaxDeclarationResponse {
  tenantId: string
  year: number
  month: number
  periodName: string
  formulario104: F104FormularioIvaDto
  formulario103: F103FormularioRetencionesDto
  conciliacion: ConciliacionSasDto
}
