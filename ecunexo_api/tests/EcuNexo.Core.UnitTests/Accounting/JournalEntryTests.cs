using EcuNexo.Core.Accounting;

namespace EcuNexo.Core.UnitTests.Accounting;

public class JournalEntryTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _accountCashId = Guid.NewGuid();
    private readonly Guid _accountSalesId = Guid.NewGuid();
    private readonly Guid _accountVatId = Guid.NewGuid();

    [Fact]
    public void JournalEntryLine_ValidDebitLine_ShouldSucceed()
    {
        var result = JournalEntryLine.Create(
            Guid.NewGuid(),
            _accountCashId,
            "1.1.01.01",
            "Caja General",
            debit: 115.00m,
            credit: 0m,
            reference: "Cobro en efectivo"
        );

        Assert.True(result.IsSuccess);
        var line = result.Value!;
        Assert.Equal(115.00m, line.Debit);
        Assert.Equal(0m, line.Credit);
        Assert.Equal("1.1.01.01", line.AccountCode);
        Assert.Equal("Cobro en efectivo", line.Reference);
    }

    [Fact]
    public void JournalEntryLine_BothDebitAndCredit_ShouldFail()
    {
        var result = JournalEntryLine.Create(
            Guid.NewGuid(),
            _accountCashId,
            "1.1.01.01",
            "Caja General",
            debit: 100m,
            credit: 100m
        );

        Assert.True(result.IsFailure);
        Assert.Equal("accounting.journal_entry_line.both_amounts", result.Error!.Code);
    }

    [Fact]
    public void JournalEntryLine_BothZero_ShouldFail()
    {
        var result = JournalEntryLine.Create(
            Guid.NewGuid(),
            _accountCashId,
            "1.1.01.01",
            "Caja General",
            debit: 0m,
            credit: 0m
        );

        Assert.True(result.IsFailure);
        Assert.Equal("accounting.journal_entry_line.zero_amounts", result.Error!.Code);
    }

    [Fact]
    public void JournalEntry_BalancedEntry_ShouldSucceedAndCalculateTotals()
    {
        var line1 = JournalEntryLine.Create(Guid.NewGuid(), _accountCashId, "1.1.01.01", "Caja General", 115m, 0m).Value!;
        var line2 = JournalEntryLine.Create(Guid.NewGuid(), _accountSalesId, "4.1.01.01", "Ventas 15%", 0m, 100m).Value!;
        var line3 = JournalEntryLine.Create(Guid.NewGuid(), _accountVatId, "2.1.02.01", "IVA Ventas por Pagar", 0m, 15m).Value!;

        var result = JournalEntry.Create(
            Guid.NewGuid(),
            _tenantId,
            "AS-2026-000001",
            new DateOnly(2026, 9, 13),
            "Por venta de mercaderías según factura 001-001-000000001",
            JournalEntrySource.SalesInvoice,
            sourceId: Guid.NewGuid(),
            sourceReference: "001-001-000000001",
            status: JournalEntryStatus.Posted,
            lines: new List<JournalEntryLine> { line1, line2, line3 }
        );

        Assert.True(result.IsSuccess);
        var entry = result.Value!;
        Assert.Equal(115.00m, entry.TotalDebit);
        Assert.Equal(115.00m, entry.TotalCredit);
        Assert.True(entry.IsBalanced);
        Assert.Equal(JournalEntryStatus.Posted, entry.Status);
        Assert.Equal(3, entry.Lines.Count);
    }

    [Fact]
    public void JournalEntry_UnbalancedEntry_WhenPosted_ShouldFail()
    {
        var line1 = JournalEntryLine.Create(Guid.NewGuid(), _accountCashId, "1.1.01.01", "Caja General", 100m, 0m).Value!;
        var line2 = JournalEntryLine.Create(Guid.NewGuid(), _accountSalesId, "4.1.01.01", "Ventas 15%", 0m, 80m).Value!;

        var result = JournalEntry.Create(
            Guid.NewGuid(),
            _tenantId,
            "AS-2026-000002",
            new DateOnly(2026, 9, 13),
            "Asiento descuadrado",
            status: JournalEntryStatus.Posted,
            lines: new List<JournalEntryLine> { line1, line2 }
        );

        Assert.True(result.IsFailure);
        Assert.Equal("accounting.journal_entry.unbalanced", result.Error!.Code);
    }

    [Fact]
    public void JournalEntry_DraftCanBeBalancedAndPostedLater()
    {
        var line1 = JournalEntryLine.Create(Guid.NewGuid(), _accountCashId, "1.1.01.01", "Caja General", 50m, 0m).Value!;

        var entryResult = JournalEntry.Create(
            Guid.NewGuid(),
            _tenantId,
            "AS-2026-000003",
            new DateOnly(2026, 9, 13),
            "Borrador en preparación",
            status: JournalEntryStatus.Draft,
            lines: new List<JournalEntryLine> { line1 }
        );

        Assert.True(entryResult.IsSuccess);
        var entry = entryResult.Value!;
        Assert.Equal(JournalEntryStatus.Draft, entry.Status);

        // Intentar contabilizar antes de balancear falla
        var postFail = entry.Post();
        Assert.True(postFail.IsFailure);
        Assert.Equal("accounting.journal_entry.minimum_lines", postFail.Error!.Code);

        // Agregar la contrapartida
        var line2 = JournalEntryLine.Create(Guid.NewGuid(), _accountSalesId, "4.1.01.02", "Ventas 0%", 0m, 50m).Value!;
        Assert.True(entry.AddLine(line2).IsSuccess);

        // Ahora contabilizar triunfa
        var postOk = entry.Post();
        Assert.True(postOk.IsSuccess);
        Assert.Equal(JournalEntryStatus.Posted, entry.Status);
        Assert.True(entry.IsBalanced);

        // Cancelar el asiento
        var cancelOk = entry.Cancel("Error en comprobante físico");
        Assert.True(cancelOk.IsSuccess);
        Assert.Equal(JournalEntryStatus.Cancelled, entry.Status);
        Assert.Contains("[ANULADO: Error en comprobante físico]", entry.Description);
    }
}
