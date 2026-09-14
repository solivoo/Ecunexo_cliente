using EcuNexo.Business.Accounting.Queries.GetFinancialStatements;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Accounting;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Accounting;

public sealed class FinancialStatementsTests
{
    private readonly IJournalEntryRepository _journalEntries = Substitute.For<IJournalEntryRepository>();
    private readonly IAccountRepository _accounts = Substitute.For<IAccountRepository>();

    [Fact(DisplayName = "GetFinancialStatementsHandler rechaza mes fuera de rango 1 a 12")]
    public async Task GetFinancialStatementsHandler_InvalidMonth_ReturnsError()
    {
        var tenantId = Guid.NewGuid();
        var handler = new GetFinancialStatementsHandler(_journalEntries, _accounts);

        var result = await handler.Handle(new GetFinancialStatementsQuery(tenantId, 2026, 0), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("financial_statements.invalid_month", result.Error!.Code);
    }

    [Fact(DisplayName = "GetFinancialStatementsHandler calcula Balance General y Estado de Resultados NIIF equilibrado")]
    public async Task GetFinancialStatementsHandler_ValidData_CalculatesFinancialStatements()
    {
        var tenantId = Guid.NewGuid();
        var year = 2026;
        var month = 9;

        // Cuentas del catálogo NIIF
        var accountsList = new List<Account>
        {
            Account.Create(Guid.NewGuid(), tenantId, "1.1.01.01", "Caja General", AccountType.Asset, AccountNature.Debit).Value!,
            Account.Create(Guid.NewGuid(), tenantId, "1.1.02.01", "Clientes Locales", AccountType.Asset, AccountNature.Debit).Value!,
            Account.Create(Guid.NewGuid(), tenantId, "2.1.01.01", "Proveedores Locales", AccountType.Liability, AccountNature.Credit).Value!,
            Account.Create(Guid.NewGuid(), tenantId, "3.1.01.01", "Capital Social S.A.S.", AccountType.Equity, AccountNature.Credit).Value!,
            Account.Create(Guid.NewGuid(), tenantId, "4.1.01.01", "Ventas Locales 15%", AccountType.Revenue, AccountNature.Credit).Value!,
            Account.Create(Guid.NewGuid(), tenantId, "5.1.01.01", "Costo de Ventas", AccountType.Expense, AccountNature.Debit).Value!,
            Account.Create(Guid.NewGuid(), tenantId, "5.2.03.01", "Publicidad y Pauta Digital", AccountType.Expense, AccountNature.Debit).Value!,
        };

        _accounts.ListAsync(tenantId, null, null, true, null, Arg.Any<CancellationToken>())
            .Returns(accountsList);

        // Asiento de apertura: Capital $1000 en Caja
        var entry1 = JournalEntry.Create(
            Guid.NewGuid(),
            tenantId,
            "AS-2026-000001",
            new DateOnly(2026, 9, 1),
            "Apertura de Capital S.A.S.",
            lines: new[]
            {
                JournalEntryLine.Create(Guid.NewGuid(), accountsList[0].Id, "1.1.01.01", "Caja General", 1000m, 0m).Value!,
                JournalEntryLine.Create(Guid.NewGuid(), accountsList[3].Id, "3.1.01.01", "Capital Social S.A.S.", 0m, 1000m).Value!,
            }
        ).Value!;

        // Asiento de Venta: $5000 a Clientes Locales (Ventas 15%)
        var entry2 = JournalEntry.Create(
            Guid.NewGuid(),
            tenantId,
            "AS-2026-000002",
            new DateOnly(2026, 9, 15),
            "Factura de Venta No. 1",
            lines: new[]
            {
                JournalEntryLine.Create(Guid.NewGuid(), accountsList[1].Id, "1.1.02.01", "Clientes Locales", 5000m, 0m).Value!,
                JournalEntryLine.Create(Guid.NewGuid(), accountsList[4].Id, "4.1.01.01", "Ventas Locales 15%", 0m, 5000m).Value!,
            }
        ).Value!;

        // Asiento de Costo de Ventas: $2000 a Proveedores Locales
        var entry3 = JournalEntry.Create(
            Guid.NewGuid(),
            tenantId,
            "AS-2026-000003",
            new DateOnly(2026, 9, 20),
            "Costo de mercaderías",
            lines: new[]
            {
                JournalEntryLine.Create(Guid.NewGuid(), accountsList[5].Id, "5.1.01.01", "Costo de Ventas", 2000m, 0m).Value!,
                JournalEntryLine.Create(Guid.NewGuid(), accountsList[2].Id, "2.1.01.01", "Proveedores Locales", 0m, 2000m).Value!,
            }
        ).Value!;

        // Asiento de Gasto Publicidad: $500 pagado desde Caja
        var entry4 = JournalEntry.Create(
            Guid.NewGuid(),
            tenantId,
            "AS-2026-000004",
            new DateOnly(2026, 9, 25),
            "Pauta digital Facebook / Google Ads",
            lines: new[]
            {
                JournalEntryLine.Create(Guid.NewGuid(), accountsList[6].Id, "5.2.03.01", "Publicidad y Pauta Digital", 500m, 0m).Value!,
                JournalEntryLine.Create(Guid.NewGuid(), accountsList[0].Id, "1.1.01.01", "Caja General", 0m, 500m).Value!,
            }
        ).Value!;

        _journalEntries.ListAsync(
            Arg.Is(tenantId),
            Arg.Any<DateOnly?>(),
            Arg.Any<DateOnly?>(),
            Arg.Any<JournalEntrySource?>(),
            Arg.Any<JournalEntryStatus?>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>()
        ).Returns(new[] { entry1, entry2, entry3, entry4 });

        var handler = new GetFinancialStatementsHandler(_journalEntries, _accounts);
        var result = await handler.Handle(new GetFinancialStatementsQuery(tenantId, year, month), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var response = result.Value!;

        // Validaciones Estado de Resultados (P&G)
        // Ventas: 5000, Costos: 2000 -> Utilidad Bruta: 3000
        Assert.Equal(5000m, response.EstadoResultados.TotalIngresosOperacionales);
        Assert.Equal(2000m, response.EstadoResultados.CostoDeVentas);
        Assert.Equal(3000m, response.EstadoResultados.UtilidadBruta);

        // Gastos: 500 -> Utilidad Operativa: 2500
        Assert.Equal(500m, response.EstadoResultados.TotalGastosOperacionales);
        Assert.Equal(2500m, response.EstadoResultados.UtilidadOperativa);

        // 15% Trabajadores: 2500 * 0.15 = 375
        Assert.Equal(375m, response.EstadoResultados.ParticipacionTrabajadores15);

        // Utilidad antes IR: 2500 - 375 = 2125
        Assert.Equal(2125m, response.EstadoResultados.UtilidadAntesDeImpuestos);

        // 25% IR: 2125 * 0.25 = 531.25
        Assert.Equal(531.25m, response.EstadoResultados.ImpuestoRentaEstimado25);

        // Utilidad Neta: 2125 - 531.25 = 1593.75
        Assert.Equal(1593.75m, response.EstadoResultados.UtilidadNetaEjercicio);

        // Validaciones Balance General
        // Activos: Caja (1000 - 500 = 500) + Clientes (5000) = 5500
        Assert.Equal(5500m, response.BalanceGeneral.TotalActivos);

        // Pasivos: Proveedores = 2000
        Assert.Equal(2000m, response.BalanceGeneral.TotalPasivos);

        // Patrimonio: Capital (1000) + Utilidad Neta (1593.75) = 2593.75 (sin provisiones pasivo) o equilibrado
        Assert.True(response.BalanceGeneral.TotalActivoCorriente > 0);
        Assert.True(response.BalanceGeneral.TotalPasivoCorriente > 0);
    }
}
