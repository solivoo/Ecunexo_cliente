using EcuNexo.Business.Accounting.Queries.GetMonthlyTaxDeclaration;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Purchases;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Accounting;

public sealed class TaxDeclarationsTests
{
    private readonly IPurchaseRepository _purchases = Substitute.For<IPurchaseRepository>();
    private readonly IJournalEntryRepository _journalEntries = Substitute.For<IJournalEntryRepository>();
    private readonly IAccountRepository _accounts = Substitute.For<IAccountRepository>();

    [Fact(DisplayName = "GetMonthlyTaxDeclarationHandler rechaza mes fuera de rango 1 a 12")]
    public async Task GetMonthlyTaxDeclarationHandler_InvalidMonth_ReturnsError()
    {
        var tenantId = Guid.NewGuid();
        var handler = new GetMonthlyTaxDeclarationHandler(_purchases, _journalEntries, _accounts);

        var result = await handler.Handle(new GetMonthlyTaxDeclarationQuery(tenantId, 2026, 13), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("tax_declaration.invalid_month", result.Error!.Code);
    }

    [Fact(DisplayName = "GetMonthlyTaxDeclarationHandler liquida F104 y F103 con conciliación SAS")]
    public async Task GetMonthlyTaxDeclarationHandler_ValidData_CalculatesF104AndF103()
    {
        var tenantId = Guid.NewGuid();
        var year = 2026;
        var month = 9;

        // Compras y Liquidaciones simuladas
        var purchase1 = Purchase.Create(
            Guid.NewGuid(),
            tenantId,
            Guid.NewGuid(),
            documentType: "01",
            invoiceNumber: "001-002-000001000",
            issueDate: new DateOnly(2026, 9, 10),
            authorizationNumber: "1009202601179001691900120010020000010001234567812"
        ).Value!;

        var pItem1 = PurchaseItem.Create(
            Guid.NewGuid(),
            purchase1.Id,
            description: "Equipos y Laptops",
            quantity: 2,
            unitPrice: 500m,
            taxRate: 15m
        ).Value!;
        purchase1.AddItem(pItem1);
        purchase1.MarkAsReceived(Guid.NewGuid());

        var settlement1 = Purchase.Create(
            Guid.NewGuid(),
            tenantId,
            Guid.NewGuid(),
            documentType: "03",
            invoiceNumber: "001-001-000000050",
            issueDate: new DateOnly(2026, 9, 12),
            authorizationNumber: "1209202603179001691900110010010000000501234567812"
        ).Value!;

        var sItem1 = PurchaseItem.Create(
            Guid.NewGuid(),
            settlement1.Id,
            description: "Mano de obra ocasional",
            quantity: 1,
            unitPrice: 200m,
            taxRate: 15m
        ).Value!;
        settlement1.AddItem(sItem1);
        settlement1.MarkAsReceived(Guid.NewGuid());

        _purchases.ListAsync(tenantId, Arg.Any<Guid?>(), Arg.Any<PurchaseStatus?>(), Arg.Any<DateOnly?>(), Arg.Any<DateOnly?>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new List<Purchase> { purchase1, settlement1 });

        // Asiento de Ventas simulado
        var accCaja = Account.Create(Guid.NewGuid(), tenantId, "1.1.01.01", "Caja", AccountType.Asset, AccountNature.Debit, null, null, true).Value!;
        var accVentas = Account.Create(Guid.NewGuid(), tenantId, "4.1.01.01", "Ventas 15%", AccountType.Revenue, AccountNature.Credit, null, null, true).Value!;
        var accIvaVentas = Account.Create(Guid.NewGuid(), tenantId, "2.1.02.01", "IVA Ventas", AccountType.Liability, AccountNature.Credit, null, null, true).Value!;

        var lineCaja = JournalEntryLine.Create(Guid.NewGuid(), accCaja.Id, accCaja.Code, accCaja.Name, 2300m, 0m).Value!;
        var lineVentas = JournalEntryLine.Create(Guid.NewGuid(), accVentas.Id, accVentas.Code, accVentas.Name, 0m, 2000m).Value!;
        var lineIva = JournalEntryLine.Create(Guid.NewGuid(), accIvaVentas.Id, accIvaVentas.Code, accIvaVentas.Name, 0m, 300m).Value!;

        var entryVentas = JournalEntry.Create(
            Guid.NewGuid(),
            tenantId,
            "AS-2026-000010",
            new DateOnly(2026, 9, 13),
            "Resumen Ventas Mensuales",
            JournalEntrySource.SalesInvoice,
            status: JournalEntryStatus.Posted,
            lines: new[] { lineCaja, lineVentas, lineIva }).Value!;

        _journalEntries.ListAsync(tenantId, Arg.Any<DateOnly?>(), Arg.Any<DateOnly?>(), Arg.Any<JournalEntrySource?>(), JournalEntryStatus.Posted, Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new List<JournalEntry> { entryVentas });

        var handler = new GetMonthlyTaxDeclarationHandler(_purchases, _journalEntries, _accounts);
        var result = await handler.Handle(new GetMonthlyTaxDeclarationQuery(tenantId, year, month), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var res = result.Value!;

        // Verificaciones F104
        Assert.Equal(2000m, res.Formulario104.Ventas.Casillero401BaseGravada);
        Assert.Equal(300m, res.Formulario104.Ventas.Casillero411IvaGenerado);
        Assert.Equal(1200m, res.Formulario104.Compras.Casillero500BaseGravada); // 1000 de factura + 200 de liquidacion
        Assert.Equal(180m, res.Formulario104.Compras.Casillero510IvaPagado); // 150 + 30
        Assert.Equal(1.0000m, res.Formulario104.Compras.Casillero564FactorProporcionalidad);
        Assert.Equal(180m, res.Formulario104.Compras.Casillero569CreditoTributarioAplicable);

        // Impuesto causado a pagar: 300 (IVA ventas) - 180 (IVA compras) = 120
        Assert.Equal(120m, res.Formulario104.Liquidacion.Casillero601ImpuestoCausado);
        Assert.Equal(120m, res.Formulario104.Liquidacion.SaldoNetoAPagar);
        Assert.True(res.Formulario104.Liquidacion.GeneraImpuestoAPagar);

        // Verificaciones F103 Retenciones
        Assert.Equal(2, res.Formulario103.Lineas.Count);
        Assert.Contains(res.Formulario103.Lineas, l => l.CodigoRetencion == "343" && l.MontoRetenido == 2.00m); // 1% de $200
        Assert.Contains(res.Formulario103.Lineas, l => l.CodigoRetencion == "312" && l.MontoRetenido == 17.50m); // 1.75% de $1000
        Assert.Equal(19.50m, res.Formulario103.TotalRetenidoAPagar);

        // Verificaciones Conciliación SAS
        Assert.Equal(1, res.Conciliacion.TotalFacturasCompra);
        Assert.Equal(1, res.Conciliacion.TotalLiquidacionesCompra);
        Assert.Equal(2000m, res.Conciliacion.TotalVentasNetas);
        Assert.Equal(1200m, res.Conciliacion.TotalComprasNetas);
        Assert.Equal(800m, res.Conciliacion.MargenBrutoOperativo); // 2000 - 1200
        Assert.True(res.Conciliacion.TodoCuadradoNIIF);
    }
}
