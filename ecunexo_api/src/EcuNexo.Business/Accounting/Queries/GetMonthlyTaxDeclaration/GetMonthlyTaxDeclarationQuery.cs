using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Accounting.Queries.GetMonthlyTaxDeclaration;

public sealed record F104VentasSummaryDto(
    decimal Casillero401BaseGravada,
    decimal Casillero411IvaGenerado,
    decimal Casillero403BaseTarifaCero,
    decimal Casillero429TotalVentas,
    decimal Casillero499TotalImpuestoGenerado);

public sealed record F104ComprasSummaryDto(
    decimal Casillero500BaseGravada,
    decimal Casillero510IvaPagado,
    decimal Casillero507BaseTarifaCero,
    decimal Casillero529TotalAdquisiciones,
    decimal Casillero564FactorProporcionalidad,
    decimal Casillero569CreditoTributarioAplicable);

public sealed record F104LiquidacionSummaryDto(
    decimal Casillero601ImpuestoCausado,
    decimal Casillero609RetencionesIvaRecibidas,
    decimal Casillero615CreditoTributarioMesSiguiente,
    decimal SaldoNetoAPagar,
    bool GeneraImpuestoAPagar);

public sealed record F104FormularioIvaDto(
    F104VentasSummaryDto Ventas,
    F104ComprasSummaryDto Compras,
    F104LiquidacionSummaryDto Liquidacion);

public sealed record F103RetencionLineaDto(
    string CodigoRetencion,
    string Descripcion,
    decimal Porcentaje,
    decimal BaseImponible,
    decimal MontoRetenido);

public sealed record F103FormularioRetencionesDto(
    IReadOnlyList<F103RetencionLineaDto> Lineas,
    decimal TotalBaseImponible,
    decimal TotalRetenidoAPagar);

public sealed record ConciliacionSasDto(
    int TotalFacturasCompra,
    int TotalLiquidacionesCompra,
    int TotalAsientosContabilizados,
    decimal TotalVentasNetas,
    decimal TotalComprasNetas,
    decimal MargenBrutoOperativo,
    decimal FlujoTributarioNetoEstimado,
    bool TodoCuadradoNIIF);

public sealed record MonthlyTaxDeclarationResponse(
    Guid TenantId,
    int Year,
    int Month,
    string PeriodName,
    F104FormularioIvaDto Formulario104,
    F103FormularioRetencionesDto Formulario103,
    ConciliacionSasDto Conciliacion);

public sealed record GetMonthlyTaxDeclarationQuery(
    Guid TenantId,
    int Year,
    int Month) : IQuery<MonthlyTaxDeclarationResponse>;

public sealed class GetMonthlyTaxDeclarationHandler : IQueryHandler<GetMonthlyTaxDeclarationQuery, MonthlyTaxDeclarationResponse>
{
    private readonly IPurchaseRepository _purchases;
    private readonly IJournalEntryRepository _journalEntries;
    private readonly IAccountRepository _accounts;

    public GetMonthlyTaxDeclarationHandler(
        IPurchaseRepository purchases,
        IJournalEntryRepository journalEntries,
        IAccountRepository accounts)
    {
        _purchases = purchases;
        _journalEntries = journalEntries;
        _accounts = accounts;
    }

    public async Task<Result<MonthlyTaxDeclarationResponse>> Handle(
        GetMonthlyTaxDeclarationQuery query,
        CancellationToken ct)
    {
        if (query.Month < 1 || query.Month > 12)
        {
            return Result.Failure<MonthlyTaxDeclarationResponse>(
                new Error("tax_declaration.invalid_month", "El mes debe estar comprendido entre 1 y 12.", ErrorType.Validation));
        }

        var from = new DateOnly(query.Year, query.Month, 1);
        var daysInMonth = DateTime.DaysInMonth(query.Year, query.Month);
        var to = new DateOnly(query.Year, query.Month, daysInMonth);

        // 1. Obtener compras y liquidaciones del período
        var purchasesList = await _purchases.ListAsync(
            tenantId: query.TenantId,
            supplierId: null,
            status: null,
            from: from,
            to: to,
            search: null,
            documentType: null,
            ct: ct).ConfigureAwait(false);

        var validPurchases = purchasesList
            .Where(p => p.Status != PurchaseStatus.Draft && p.Status != PurchaseStatus.Cancelled)
            .ToList();

        // Si no hay compras recibidas o facturadas, incluimos borradores para previsualización preventiva si es el único registro
        if (validPurchases.Count == 0 && purchasesList.Count > 0)
        {
            validPurchases = purchasesList.Where(p => p.Status != PurchaseStatus.Cancelled).ToList();
        }

        var facturasCompra = validPurchases.Where(p => p.DocumentType == "01").ToList();
        var liquidacionesCompra = validPurchases.Where(p => p.DocumentType == "03").ToList();

        // 2. Obtener asientos contables del período
        var entries = await _journalEntries.ListAsync(
            tenantId: query.TenantId,
            from: from,
            to: to,
            source: null,
            status: JournalEntryStatus.Posted,
            search: null,
            ct: ct).ConfigureAwait(false);

        // Analizar apuntes de ventas (Ingresos - Grupo 4)
        decimal ventasGravadas = 0m;
        decimal ventasCero = 0m;
        decimal ivaVentasGenerado = 0m;

        foreach (var entry in entries)
        {
            foreach (var line in entry.Lines)
            {
                if (line.AccountCode.StartsWith("4.1.01.01", StringComparison.Ordinal) ||
                    (line.AccountCode.StartsWith("4.", StringComparison.Ordinal) && line.Credit > 0))
                {
                    ventasGravadas += line.Credit;
                }
                else if (line.AccountCode.StartsWith("4.1.01.02", StringComparison.Ordinal))
                {
                    ventasCero += line.Credit;
                }
                else if (line.AccountCode.StartsWith("2.1.02.01", StringComparison.Ordinal))
                {
                    // IVA Ventas por pagar
                    ivaVentasGenerado += line.Credit;
                }
            }
        }

        // Si el IVA en ventas no está registrado por apunte explícito, calcular tarifa 15% sobre ventas gravadas
        if (ivaVentasGenerado == 0m && ventasGravadas > 0m)
        {
            ivaVentasGenerado = Math.Round(ventasGravadas * 0.15m, 2, MidpointRounding.AwayFromZero);
        }

        var totalVentas = ventasGravadas + ventasCero;
        var f104Ventas = new F104VentasSummaryDto(
            Casillero401BaseGravada: ventasGravadas,
            Casillero411IvaGenerado: ivaVentasGenerado,
            Casillero403BaseTarifaCero: ventasCero,
            Casillero429TotalVentas: totalVentas,
            Casillero499TotalImpuestoGenerado: ivaVentasGenerado);

        // Analizar compras y crédito fiscal
        var comprasGravadas = validPurchases.Sum(p => p.SubtotalTaxed);
        var ivaComprasPagado = validPurchases.Sum(p => p.TaxAmount);
        var comprasCero = validPurchases.Sum(p => p.SubtotalZero + p.SubtotalNoSubject + p.SubtotalExempt);
        var totalAdquisiciones = comprasGravadas + comprasCero;

        // Proporcionalidad (Factor = Ventas Gravadas / Total Ventas)
        var factorProporcionalidad = totalVentas > 0
            ? Math.Round(ventasGravadas / totalVentas, 4, MidpointRounding.AwayFromZero)
            : 1.0000m;

        var creditoTributarioAplicable = Math.Round(ivaComprasPagado * factorProporcionalidad, 2, MidpointRounding.AwayFromZero);

        var f104Compras = new F104ComprasSummaryDto(
            Casillero500BaseGravada: comprasGravadas,
            Casillero510IvaPagado: ivaComprasPagado,
            Casillero507BaseTarifaCero: comprasCero,
            Casillero529TotalAdquisiciones: totalAdquisiciones,
            Casillero564FactorProporcionalidad: factorProporcionalidad,
            Casillero569CreditoTributarioAplicable: creditoTributarioAplicable);

        // Liquidación mensual
        var diferenciaIva = ivaVentasGenerado - creditoTributarioAplicable;
        var impuestoCausado = Math.Max(0m, diferenciaIva);
        var creditoMesSiguiente = diferenciaIva < 0m ? Math.Abs(diferenciaIva) : 0m;
        var retencionesIvaRecibidas = 0m; // Se completa con módulo de cobros / retenciones de clientes

        var saldoNetoAPagar = Math.Max(0m, impuestoCausado - retencionesIvaRecibidas);
        var generaAPagar = saldoNetoAPagar > 0m;

        var f104Liquidacion = new F104LiquidacionSummaryDto(
            Casillero601ImpuestoCausado: impuestoCausado,
            Casillero609RetencionesIvaRecibidas: retencionesIvaRecibidas,
            Casillero615CreditoTributarioMesSiguiente: creditoMesSiguiente,
            SaldoNetoAPagar: saldoNetoAPagar,
            GeneraImpuestoAPagar: generaAPagar);

        var f104 = new F104FormularioIvaDto(f104Ventas, f104Compras, f104Liquidacion);

        // Formulario 103 (Retenciones en la fuente aplicadas en compras / liquidaciones)
        var lineasRetencion = new List<F103RetencionLineaDto>();

        // En liquidaciones de compra (03), retención del 1% o 2% a personas sin RUC
        var baseLiquidaciones = liquidacionesCompra.Sum(l => l.SubtotalTaxed + l.SubtotalZero);
        if (baseLiquidaciones > 0m)
        {
            var retLiquidaciones = Math.Round(baseLiquidaciones * 0.01m, 2, MidpointRounding.AwayFromZero);
            lineasRetencion.Add(new F103RetencionLineaDto(
                CodigoRetencion: "343",
                Descripcion: "Liquidaciones de Compra a personas naturales no obligadas a llevar contabilidad",
                Porcentaje: 1.00m,
                BaseImponible: baseLiquidaciones,
                MontoRetenido: retLiquidaciones));
        }

        // Compras a sociedades con retención 1.75% de bienes
        var baseComprasBienes = facturasCompra.Sum(f => f.SubtotalTaxed);
        if (baseComprasBienes > 0m)
        {
            var retBienes = Math.Round(baseComprasBienes * 0.0175m, 2, MidpointRounding.AwayFromZero);
            lineasRetencion.Add(new F103RetencionLineaDto(
                CodigoRetencion: "312",
                Descripcion: "Transferencia de bienes muebles de naturaleza corporal",
                Porcentaje: 1.75m,
                BaseImponible: baseComprasBienes,
                MontoRetenido: retBienes));
        }

        var totalBaseRet = lineasRetencion.Sum(l => l.BaseImponible);
        var totalRetAPagar = lineasRetencion.Sum(l => l.MontoRetenido);
        var f103 = new F103FormularioRetencionesDto(lineasRetencion.AsReadOnly(), totalBaseRet, totalRetAPagar);

        // Conciliación S.A.S.
        var todoCuadrado = entries.All(e => e.IsBalanced);
        var margenBruto = totalVentas - totalAdquisiciones;
        var flujoTributarioNeto = saldoNetoAPagar + totalRetAPagar;

        var periodName = new DateTime(query.Year, query.Month, 1).ToString("MMMM yyyy", System.Globalization.CultureInfo.GetCultureInfo("es-EC"));

        var conciliacion = new ConciliacionSasDto(
            TotalFacturasCompra: facturasCompra.Count,
            TotalLiquidacionesCompra: liquidacionesCompra.Count,
            TotalAsientosContabilizados: entries.Count,
            TotalVentasNetas: totalVentas,
            TotalComprasNetas: totalAdquisiciones,
            MargenBrutoOperativo: margenBruto,
            FlujoTributarioNetoEstimado: flujoTributarioNeto,
            TodoCuadradoNIIF: todoCuadrado);

        var response = new MonthlyTaxDeclarationResponse(
            TenantId: query.TenantId,
            Year: query.Year,
            Month: query.Month,
            PeriodName: char.ToUpper(periodName[0], System.Globalization.CultureInfo.CurrentCulture) + periodName[1..],
            Formulario104: f104,
            Formulario103: f103,
            Conciliacion: conciliacion);

        return Result.Success(response);
    }
}
