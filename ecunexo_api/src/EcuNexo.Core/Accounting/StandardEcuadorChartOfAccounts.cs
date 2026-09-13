namespace EcuNexo.Core.Accounting;

/// <summary>
/// Definición de plantilla del catálogo oficial de cuentas contables del Ecuador (NIIF / SCVS).
/// </summary>
public record StandardAccountDefinition(
    string Code,
    string Name,
    AccountType Type,
    AccountNature Nature,
    bool AllowsMovement,
    string? Description = null);

/// <summary>
/// Catálogo oficial estándar SCVS / NIIF Ecuador para inicializar nuevos tenants o activar el módulo contable.
/// </summary>
public static class StandardEcuadorChartOfAccounts
{
    public static readonly IReadOnlyList<StandardAccountDefinition> DefaultCatalog = new List<StandardAccountDefinition>
    {
        // 1. ACTIVO
        new("1", "ACTIVO", AccountType.Asset, AccountNature.Debit, false, "Total activo de la empresa"),
        new("1.1", "ACTIVO CORRIENTE", AccountType.Asset, AccountNature.Debit, false, "Bienes y derechos líquidos o realizables en menos de un año"),
        
        // 1.1.01 Disponible / Efectivo
        new("1.1.01", "EFECTIVO Y EQUIVALENTES AL EFECTIVO", AccountType.Asset, AccountNature.Debit, false, "Disponibilidades inmediatas de liquidez"),
        new("1.1.01.01", "Caja General", AccountType.Asset, AccountNature.Debit, true, "Efectivo en caja para operaciones diarias"),
        new("1.1.01.02", "Caja Chica", AccountType.Asset, AccountNature.Debit, true, "Fondo fijo rotativo para gastos menores"),
        new("1.1.01.03", "Bancos Cuentas Corrientes", AccountType.Asset, AccountNature.Debit, true, "Saldos en cuentas corrientes bancarias"),
        new("1.1.01.04", "Bancos Cuentas de Ahorros", AccountType.Asset, AccountNature.Debit, true, "Saldos en cuentas de ahorros bancarias"),

        // 1.1.02 Exigible / Cartera
        new("1.1.02", "CUENTAS Y DOCUMENTOS POR COBRAR", AccountType.Asset, AccountNature.Debit, false, "Derechos de cobro a clientes y terceros"),
        new("1.1.02.01", "Clientes Locales", AccountType.Asset, AccountNature.Debit, true, "Facturas por cobrar a clientes nacionales"),
        new("1.1.02.02", "Clientes del Exterior", AccountType.Asset, AccountNature.Debit, true, "Facturas por cobrar a clientes internacionales"),
        new("1.1.02.03", "Otras Cuentas por Cobrar", AccountType.Asset, AccountNature.Debit, true, "Cuentas por cobrar diversas a empleados o socios"),
        new("1.1.02.05", "Anticipos Entregados a Proveedores", AccountType.Asset, AccountNature.Debit, true, "Anticipos a compras o servicios pendientes de facturar"),

        // 1.1.03 Realizable / Inventarios
        new("1.1.03", "INVENTARIOS", AccountType.Asset, AccountNature.Debit, false, "Bienes disponibles para la venta o transformación"),
        new("1.1.03.01", "Inventario de Mercaderías para la Venta", AccountType.Asset, AccountNature.Debit, true, "Existencias en bodega para comercialización (Kárdex)"),
        new("1.1.03.02", "Inventario de Repuestos y Materiales", AccountType.Asset, AccountNature.Debit, true, "Repuestos e insumos para servicio técnico"),
        new("1.1.03.03", "Mercaderías en Tránsito e Importaciones", AccountType.Asset, AccountNature.Debit, true, "Bienes adquiridos en tránsito hacia bodega"),

        // 1.1.04 Crédito Tributario SRI
        new("1.1.04", "CRÉDITO TRIBUTARIO A FAVOR DEL SUJETO PASIVO", AccountType.Asset, AccountNature.Debit, false, "Créditos fiscales exigibles al SRI"),
        new("1.1.04.01", "Crédito Tributario IVA Compras (15%)", AccountType.Asset, AccountNature.Debit, true, "IVA soportado en compras con derecho a crédito tributario"),
        new("1.1.04.02", "Retenciones en la Fuente de IR Recibidas", AccountType.Asset, AccountNature.Debit, true, "Retenciones IR que clientes le aplicaron a la empresa"),
        new("1.1.04.03", "Retenciones de IVA Recibidas", AccountType.Asset, AccountNature.Debit, true, "Retenciones de IVA que agentes de retención aplicaron"),

        // 1.2 ACTIVO NO CORRIENTE
        new("1.2", "ACTIVO NO CORRIENTE", AccountType.Asset, AccountNature.Debit, false, "Bienes tangibles e intangibles de largo plazo"),
        new("1.2.01", "PROPIEDAD, PLANTA Y EQUIPO", AccountType.Asset, AccountNature.Debit, false, "Activos fijos operativos"),
        new("1.2.01.01", "Muebles y Enseres de Oficina", AccountType.Asset, AccountNature.Debit, true, "Mobiliario administrativo y comercial"),
        new("1.2.01.02", "Equipos de Computación y Software", AccountType.Asset, AccountNature.Debit, true, "Computadoras, servidores y terminales"),
        new("1.2.01.03", "Vehículos y Equipos de Transporte", AccountType.Asset, AccountNature.Debit, true, "Flota vehicular de despacho"),
        new("1.2.01.04", "Herramientas e Instrumental Técnico", AccountType.Asset, AccountNature.Debit, true, "Equipos de diagnóstico de taller"),
        new("1.2.01.09", "Depreciación Acumulada Activo Fijo (-)", AccountType.Asset, AccountNature.Credit, true, "Contra-activo por depreciación acumulada"),

        // 2. PASIVO
        new("2", "PASIVO", AccountType.Liability, AccountNature.Credit, false, "Total pasivo y obligaciones de la empresa"),
        new("2.1", "PASIVO CORRIENTE", AccountType.Liability, AccountNature.Credit, false, "Obligaciones exigibles a menos de un año"),

        // 2.1.01 Cuentas por Pagar Comerciales
        new("2.1.01", "CUENTAS Y DOCUMENTOS POR PAGAR", AccountType.Liability, AccountNature.Credit, false, "Deudas comerciales con proveedores"),
        new("2.1.01.01", "Proveedores Locales", AccountType.Liability, AccountNature.Credit, true, "Facturas por pagar a proveedores nacionales"),
        new("2.1.01.02", "Proveedores del Exterior", AccountType.Liability, AccountNature.Credit, true, "Facturas por pagar a proveedores extranjeros"),
        new("2.1.01.03", "Anticipos de Clientes", AccountType.Liability, AccountNature.Credit, true, "Pagos anticipados recibidos de clientes por compras o pedidos"),

        // 2.1.02 Tributarias SRI
        new("2.1.02", "OBLIGACIONES CON LA ADMINISTRACIÓN TRIBUTARIA (SRI)", AccountType.Liability, AccountNature.Credit, false, "Impuestos y retenciones por pagar al SRI"),
        new("2.1.02.01", "IVA en Ventas por Pagar (15%)", AccountType.Liability, AccountNature.Credit, true, "IVA recaudado en facturación a liquidar con SRI"),
        new("2.1.02.02", "Retenciones en la Fuente IR Emitidas por Pagar", AccountType.Liability, AccountNature.Credit, true, "Retenciones IR practicadas a proveedores a transferir al SRI"),
        new("2.1.02.03", "Retenciones de IVA Emitidas por Pagar", AccountType.Liability, AccountNature.Credit, true, "Retenciones IVA practicadas a proveedores a transferir al SRI"),

        // 2.1.03 Laborales e IESS
        new("2.1.03", "OBLIGACIONES CON EL PERSONAL Y SEGURIDAD SOCIAL (IESS)", AccountType.Liability, AccountNature.Credit, false, "Obligaciones con trabajadores e Instituto de Seguridad Social"),
        new("2.1.03.01", "Sueldos y Salarios por Pagar", AccountType.Liability, AccountNature.Credit, true, "Remuneraciones mensuales pendientes de liquidación"),
        new("2.1.03.02", "Aportes al IESS por Pagar (Personal y Patronal)", AccountType.Liability, AccountNature.Credit, true, "Planillas de aportes al Seguro Social"),
        new("2.1.03.03", "Beneficios Sociales por Pagar (13ro, 14to, Fondos)", AccountType.Liability, AccountNature.Credit, true, "Provisiones y liquidaciones de beneficios de ley"),

        // 3. PATRIMONIO
        new("3", "PATRIMONIO NETO", AccountType.Equity, AccountNature.Credit, false, "Capital, reservas y resultados acumulados"),
        new("3.1", "CAPITAL", AccountType.Equity, AccountNature.Credit, false, "Capital social suscrito y pagado"),
        new("3.1.01", "Capital Social Suscrito y/o Asignado", AccountType.Equity, AccountNature.Credit, true, "Capital social según escrituras o SAS"),
        new("3.2", "RESERVAS", AccountType.Equity, AccountNature.Credit, false, "Reservas legales y estatutarias"),
        new("3.2.01", "Reserva Legal", AccountType.Equity, AccountNature.Credit, true, "Apropiaciones de utilidades exigidas por ley"),
        new("3.3", "RESULTADOS DEL EJERCICIO", AccountType.Equity, AccountNature.Credit, false, "Superávit o déficit del ejercicio y acumulados"),
        new("3.3.01", "Utilidad Acumulada de Ejercicios Anteriores", AccountType.Equity, AccountNature.Credit, true, "Ganancias de años anteriores no distribuidas"),
        new("3.3.02", "Pérdida Acumulada de Ejercicios Anteriores (-)", AccountType.Equity, AccountNature.Debit, true, "Pérdidas históricas a compensar"),
        new("3.3.03", "Utilidad Neta del Ejercicio", AccountType.Equity, AccountNature.Credit, true, "Ganancia contable neta del período en curso"),

        // 4. INGRESOS
        new("4", "INGRESOS", AccountType.Revenue, AccountNature.Credit, false, "Rentas e ingresos operacionales"),
        new("4.1", "INGRESOS DE ACTIVIDADES ORDINARIAS", AccountType.Revenue, AccountNature.Credit, false, "Facturación por giro del negocio"),
        new("4.1.01", "Ventas Locales de Bienes con Tarifa 15%", AccountType.Revenue, AccountNature.Credit, true, "Ingresos por venta de productos gravados IVA 15%"),
        new("4.1.02", "Ventas Locales de Bienes con Tarifa 0%", AccountType.Revenue, AccountNature.Credit, true, "Ingresos por venta de productos tarifa 0%"),
        new("4.1.03", "Prestación de Servicios y Reparaciones de Taller", AccountType.Revenue, AccountNature.Credit, true, "Ingresos por mano de obra técnica y soporte"),
        new("4.1.04", "Devoluciones y Descuentos en Ventas (-)", AccountType.Revenue, AccountNature.Debit, true, "Notas de crédito y rebajas concedidas a clientes"),
        new("4.2", "OTROS INGRESOS Y FINANCIEROS", AccountType.Revenue, AccountNature.Credit, false, "Rendimientos complementarios"),
        new("4.2.01", "Intereses y Rendimientos Financieros Ganados", AccountType.Revenue, AccountNature.Credit, true, "Intereses de depósitos bancarios"),

        // 5. COSTOS Y GASTOS
        new("5", "COSTOS Y GASTOS", AccountType.Expense, AccountNature.Debit, false, "Costos operativos y gastos de administración/ventas"),
        new("5.1", "COSTO DE VENTAS Y PRODUCCIÓN", AccountType.Expense, AccountNature.Debit, false, "Costos directos vinculados a las ventas"),
        new("5.1.01", "Costo de Mercaderías Vendidas", AccountType.Expense, AccountNature.Debit, true, "Costo de adquisición de productos vendidos (Kárdex)"),
        new("5.1.02", "Costo de Materiales, Partes y Repuestos Utilizados", AccountType.Expense, AccountNature.Debit, true, "Repuestos instalados en reparaciones técnicas"),

        new("5.2", "GASTOS DE OPERACIÓN", AccountType.Expense, AccountNature.Debit, false, "Gastos administrativos, logísticos y comerciales"),
        // 5.2.01 Personal
        new("5.2.01", "GASTOS DE PERSONAL", AccountType.Expense, AccountNature.Debit, false, "Nómina y beneficios de empleados"),
        new("5.2.01.01", "Sueldos, Salarios y Demás Remuneraciones", AccountType.Expense, AccountNature.Debit, true, "Gasto mensual de remuneraciones"),
        new("5.2.01.02", "Aporte Patronal al IESS (12.15%)", AccountType.Expense, AccountNature.Debit, true, "Aporte obligatorio empleador a la seguridad social"),
        new("5.2.01.03", "Beneficios Sociales (Décimos, Fondos de Reserva)", AccountType.Expense, AccountNature.Debit, true, "Gasto por decimotercero, decimocuarto y fondos"),

        // 5.2.02 Administración
        new("5.2.02", "GASTOS DE ADMINISTRACIÓN", AccountType.Expense, AccountNature.Debit, false, "Gastos de funcionamiento operativo y oficina"),
        new("5.2.02.01", "Arriendos de Locales, Bodegas y Oficinas", AccountType.Expense, AccountNature.Debit, true, "Alquiler de inmuebles comerciales"),
        new("5.2.02.02", "Servicios Básicos (Luz, Agua, Telecomunicaciones)", AccountType.Expense, AccountNature.Debit, true, "Agua, energía eléctrica e Internet"),
        new("5.2.02.03", "Suministros y Materiales de Oficina", AccountType.Expense, AccountNature.Debit, true, "Papelería, tóner y útiles de administración"),
        new("5.2.02.04", "Honorarios Profesionales Legales y Contables", AccountType.Expense, AccountNature.Debit, true, "Asesoría contable, auditoría y legal"),
        new("5.2.02.05", "Mantenimiento y Reparación de Equipos e Inmuebles", AccountType.Expense, AccountNature.Debit, true, "Mantenimiento locativo o de equipos"),

        // 5.2.03 Comercialización / Ventas
        new("5.2.03", "GASTOS DE VENTAS Y COMERCIALIZACIÓN", AccountType.Expense, AccountNature.Debit, false, "Gastos vinculados a e-commerce, ventas y despacho"),
        new("5.2.03.01", "Publicidad, Marketing y Pauta Digital", AccountType.Expense, AccountNature.Debit, true, "Campañas publicitarias en Meta, Google Ads y agencias"),
        new("5.2.03.02", "Fletes, Envíos y Logística de Despacho (Couriers)", AccountType.Expense, AccountNature.Debit, true, "Servientrega, Urbano, Laar y guías de envío"),
        new("5.2.03.03", "Comisiones de Pasarelas de Pago y Vendedores", AccountType.Expense, AccountNature.Debit, true, "Comisiones PayPhone, Datafast, Kushki y transferencias"),

        // 5.2.04 Financieros
        new("5.2.04", "GASTOS FINANCIEROS", AccountType.Expense, AccountNature.Debit, false, "Cargos e intereses financieros"),
        new("5.2.04.01", "Comisiones y Servicios Bancarios", AccountType.Expense, AccountNature.Debit, true, "Costos por transferencias interbancarias y estados de cuenta"),
        new("5.2.04.02", "Intereses por Préstamos Bancarios y Sobregiros", AccountType.Expense, AccountNature.Debit, true, "Cargas financieras de pasivos crediticios")
    };
}
