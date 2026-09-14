using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Commands.CreateJournalEntry;
using EcuNexo.Business.Accounting.Commands.GeneratePurchaseJournalEntry;
using EcuNexo.Business.Accounting.Queries.GetJournalEntryById;
using EcuNexo.Business.Accounting.Queries.ListJournalEntries;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Purchases;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Accounting;

public sealed class JournalEntryHandlersTests
{
    private readonly IJournalEntryRepository _journalEntries = Substitute.For<IJournalEntryRepository>();
    private readonly IAccountRepository _accounts = Substitute.For<IAccountRepository>();
    private readonly IPurchaseRepository _purchases = Substitute.For<IPurchaseRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    public JournalEntryHandlersTests()
    {
        _idGenerator.NewId().Returns(_ => Guid.NewGuid());
    }

    [Fact(DisplayName = "ListJournalEntriesHandler calcula KPIs de volumen y estados")]
    public async Task ListJournalEntriesHandler_ReturnsKpisAndEntries()
    {
        var tenantId = Guid.NewGuid();
        var acc1 = Account.Create(Guid.NewGuid(), tenantId, "1.1.01.01", "Caja", AccountType.Asset, AccountNature.Debit, null, null, true).Value!;
        var acc2 = Account.Create(Guid.NewGuid(), tenantId, "3.1.01.01", "Capital", AccountType.Equity, AccountNature.Credit, null, null, true).Value!;

        var line1 = JournalEntryLine.Create(Guid.NewGuid(), acc1.Id, acc1.Code, acc1.Name, 1000m, 0m).Value!;
        var line2 = JournalEntryLine.Create(Guid.NewGuid(), acc2.Id, acc2.Code, acc2.Name, 0m, 1000m).Value!;

        var entry1 = JournalEntry.Create(
            Guid.NewGuid(),
            tenantId,
            "AS-2026-000001",
            new DateOnly(2026, 9, 13),
            "Asiento Apertura",
            JournalEntrySource.Manual,
            status: JournalEntryStatus.Posted,
            lines: new[] { line1, line2 }).Value!;

        _journalEntries.ListAsync(tenantId, null, null, null, null, null, Arg.Any<CancellationToken>())
            .Returns(new List<JournalEntry> { entry1 });

        var handler = new ListJournalEntriesHandler(_journalEntries);
        var result = await handler.Handle(new ListJournalEntriesQuery(tenantId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value!.Kpis.TotalEntries);
        Assert.Equal(1, result.Value.Kpis.TotalPosted);
        Assert.Equal(1000m, result.Value.Kpis.TotalDebitVolume);
        Assert.Single(result.Value.Entries);
    }

    [Fact(DisplayName = "GetJournalEntryByIdHandler retorna NotFound si asiento no existe")]
    public async Task GetJournalEntryByIdHandler_WhenNotFound_ReturnsError()
    {
        var tenantId = Guid.NewGuid();
        var entryId = Guid.NewGuid();
        _journalEntries.GetByIdAsync(tenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((JournalEntry?)null);

        var handler = new GetJournalEntryByIdHandler(_journalEntries);
        var result = await handler.Handle(new GetJournalEntryByIdQuery(tenantId, entryId), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("journal_entry.not_found", result.Error!.Code);
    }

    [Fact(DisplayName = "CreateJournalEntryHandler falla si cuenta contable no permite movimiento")]
    public async Task CreateJournalEntryHandler_AccountNoMovement_ReturnsValidationError()
    {
        var tenantId = Guid.NewGuid();
        var majorAcc = Account.Create(Guid.NewGuid(), tenantId, "1.1", "Activo Corriente", AccountType.Asset, AccountNature.Debit, null, null, allowsMovement: false).Value!;
        var acc2 = Account.Create(Guid.NewGuid(), tenantId, "1.1.01.01", "Caja", AccountType.Asset, AccountNature.Debit, null, null, allowsMovement: true).Value!;

        _accounts.ListAsync(tenantId, null, null, null, null, Arg.Any<CancellationToken>())
            .Returns(new List<Account> { majorAcc, acc2 });

        var handler = new CreateJournalEntryHandler(_journalEntries, _accounts, _idGenerator, _unitOfWork);
        var command = new CreateJournalEntryCommand(
            tenantId,
            new DateOnly(2026, 9, 13),
            "Asiento inv",
            new List<CreateJournalEntryLineInput>
            {
                new(majorAcc.Id, 100m, 0m),
                new(acc2.Id, 0m, 100m)
            });

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("journal_entry.account_no_movement", result.Error!.Code);
    }

    [Fact(DisplayName = "CreateJournalEntryHandler crea y contabiliza asiento manual balanceado")]
    public async Task CreateJournalEntryHandler_Valid_CreatesAndPostsEntry()
    {
        var tenantId = Guid.NewGuid();
        var acc1 = Account.Create(Guid.NewGuid(), tenantId, "1.1.01.01", "Caja", AccountType.Asset, AccountNature.Debit, null, null, allowsMovement: true).Value!;
        var acc2 = Account.Create(Guid.NewGuid(), tenantId, "4.1.01.01", "Ventas", AccountType.Revenue, AccountNature.Credit, null, null, allowsMovement: true).Value!;

        _accounts.ListAsync(tenantId, null, null, null, null, Arg.Any<CancellationToken>())
            .Returns(new List<Account> { acc1, acc2 });
        _journalEntries.GetNextEntryNumberAsync(tenantId, 2026, Arg.Any<CancellationToken>())
            .Returns("AS-2026-000002");

        var handler = new CreateJournalEntryHandler(_journalEntries, _accounts, _idGenerator, _unitOfWork);
        var command = new CreateJournalEntryCommand(
            tenantId,
            new DateOnly(2026, 9, 13),
            "Venta contado mercadería",
            new List<CreateJournalEntryLineInput>
            {
                new(acc1.Id, 500m, 0m, "Ingreso de caja"),
                new(acc2.Id, 0m, 500m, "Venta facturada")
            },
            AutoPost: true);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Posted", result.Value!.Status.ToString());
        Assert.Equal(500m, result.Value.TotalDebit);
        Assert.Equal(500m, result.Value.TotalCredit);
        Assert.True(result.Value.IsBalanced);
        await _journalEntries.Received(1).AddAsync(Arg.Any<JournalEntry>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "GeneratePurchaseJournalEntryHandler crea asiento balanceado para liquidación de compra SRI")]
    public async Task GeneratePurchaseJournalEntryHandler_Settlement_GeneratesBalancedJournalEntry()
    {
        var tenantId = Guid.NewGuid();
        var purchaseId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();

        var purchase = Purchase.Create(
            purchaseId,
            tenantId,
            supplierId,
            documentType: "03",
            invoiceNumber: "001-002-000000100",
            issueDate: new DateOnly(2026, 9, 13),
            authorizationNumber: "1309202603019999999999910010020000001001234567812",
            sriSustentoCode: "02"
        ).Value!;

        var item = PurchaseItem.Create(
            Guid.NewGuid(),
            purchaseId,
            description: "Servicio de flete artesanal",
            quantity: 1,
            unitPrice: 200m,
            taxRate: 15m,
            affectsInventory: false
        ).Value!;

        purchase.AddItem(item);

        _purchases.GetByIdAsync(tenantId, purchaseId, Arg.Any<CancellationToken>())
            .Returns(purchase);
        _journalEntries.GetBySourceAsync(tenantId, JournalEntrySource.PurchaseSettlement, purchaseId, Arg.Any<CancellationToken>())
            .Returns((JournalEntry?)null);

        var expenseAcc = Account.Create(Guid.NewGuid(), tenantId, "5.2.01.01", "Gastos Operacionales", AccountType.Expense, AccountNature.Debit, null, null, true).Value!;
        var ivaAcc = Account.Create(Guid.NewGuid(), tenantId, "1.1.04.01", "Crédito Tributario IVA", AccountType.Asset, AccountNature.Debit, null, null, true).Value!;
        var supplierAcc = Account.Create(Guid.NewGuid(), tenantId, "2.1.01.01", "Proveedores Locales", AccountType.Liability, AccountNature.Credit, null, null, true).Value!;

        _accounts.ListAsync(tenantId, null, true, true, null, Arg.Any<CancellationToken>())
            .Returns(new List<Account> { expenseAcc, ivaAcc, supplierAcc });

        _journalEntries.GetNextEntryNumberAsync(tenantId, 2026, Arg.Any<CancellationToken>())
            .Returns("AS-2026-000003");

        var handler = new GeneratePurchaseJournalEntryHandler(_purchases, _journalEntries, _accounts, _idGenerator, _unitOfWork);
        var result = await handler.Handle(new GeneratePurchaseJournalEntryCommand(tenantId, purchaseId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(JournalEntrySource.PurchaseSettlement, result.Value!.Source);
        Assert.Equal(JournalEntryStatus.Posted, result.Value.Status);
        Assert.Equal(230m, result.Value.TotalDebit); // 200 gasto + 30 IVA
        Assert.Equal(230m, result.Value.TotalCredit); // 230 Pasivo proveedor
        Assert.True(result.Value.IsBalanced);
        Assert.Equal(3, result.Value.Lines.Count);
        await _journalEntries.Received(1).AddAsync(Arg.Any<JournalEntry>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
