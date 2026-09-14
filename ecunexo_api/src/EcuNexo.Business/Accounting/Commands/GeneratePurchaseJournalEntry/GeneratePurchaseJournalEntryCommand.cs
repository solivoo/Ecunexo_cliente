using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Commands.GeneratePurchaseJournalEntry;

public sealed record GeneratePurchaseJournalEntryCommand(
    Guid TenantId,
    Guid PurchaseId,
    Guid? UserId = null) : ICommand<JournalEntryResponse>;

public sealed class GeneratePurchaseJournalEntryHandler : ICommandHandler<GeneratePurchaseJournalEntryCommand, JournalEntryResponse>
{
    private readonly IPurchaseRepository _purchases;
    private readonly IJournalEntryRepository _journalEntries;
    private readonly IAccountRepository _accounts;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    // Códigos estándar del catálogo SCVS ecuatoriano
    private const string InventoryAccountCode = "1.1.03.01"; // Inventario de Mercaderías
    private const string ExpenseAccountCode = "5.2.01.01";   // Gastos Operacionales / Bienes y Servicios
    private const string TaxCreditAccountCode = "1.1.04.01"; // Crédito Tributario IVA Compras (15%)
    private const string SuppliersAccountCode = "2.1.01.01"; // Proveedores Locales

    public GeneratePurchaseJournalEntryHandler(
        IPurchaseRepository purchases,
        IJournalEntryRepository journalEntries,
        IAccountRepository accounts,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _purchases = purchases;
        _journalEntries = journalEntries;
        _accounts = accounts;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<JournalEntryResponse>> Handle(
        GeneratePurchaseJournalEntryCommand command,
        CancellationToken ct)
    {
        var purchase = await _purchases.GetByIdAsync(command.TenantId, command.PurchaseId, ct).ConfigureAwait(false);
        if (purchase is null)
        {
            return Result.Failure<JournalEntryResponse>(
                new Error("purchase.not_found", "La compra o liquidación especificada no existe.", ErrorType.NotFound));
        }

        // Determinar origen
        var isSettlement = purchase.DocumentType == "03";
        var source = isSettlement ? JournalEntrySource.PurchaseSettlement : JournalEntrySource.PurchaseInvoice;

        // Verificar si ya existe un asiento previo para este documento
        var existing = await _journalEntries.GetBySourceAsync(command.TenantId, source, purchase.Id, ct).ConfigureAwait(false);
        if (existing is not null)
        {
            return Result.Success(JournalEntryResponse.FromDomain(existing));
        }

        // Buscar cuentas contables en el tenant
        var allAccounts = await _accounts.ListAsync(
            tenantId: command.TenantId,
            type: null,
            allowsMovementOnly: true,
            activeOnly: true,
            search: null,
            ct: ct).ConfigureAwait(false);

        var accountsByCode = allAccounts.ToDictionary(a => a.Code, a => a);

        // Cuenta de Proveedores (Pasivo)
        if (!accountsByCode.TryGetValue(SuppliersAccountCode, out var supplierAccount))
        {
            supplierAccount = allAccounts.FirstOrDefault(a => a.AccountType == AccountType.Liability);
        }

        if (supplierAccount is null)
        {
            return Result.Failure<JournalEntryResponse>(
                new Error("journal_entry.missing_liability_account", "No se encontró una cuenta de pasivo/proveedores disponible en el catálogo de cuentas.", ErrorType.Validation));
        }

        // Cuenta de IVA Crédito Tributario
        Account? taxCreditAccount = null;
        if (purchase.TaxAmount > 0)
        {
            if (!accountsByCode.TryGetValue(TaxCreditAccountCode, out taxCreditAccount))
            {
                taxCreditAccount = allAccounts.FirstOrDefault(a => a.Code.StartsWith("1.1.04", StringComparison.Ordinal));
            }
        }

        // Cuenta de Activo Inventario o Gasto Operacional
        var affectsInventory = purchase.Items.Any(i => i.AffectsInventory);
        var mainDebitCode = affectsInventory ? InventoryAccountCode : ExpenseAccountCode;
        if (!accountsByCode.TryGetValue(mainDebitCode, out var mainDebitAccount))
        {
            mainDebitAccount = affectsInventory
                ? allAccounts.FirstOrDefault(a => a.Code.StartsWith("1.1.03", StringComparison.Ordinal) || a.AccountType == AccountType.Asset)
                : allAccounts.FirstOrDefault(a => a.AccountType == AccountType.Expense);
        }

        if (mainDebitAccount is null)
        {
            return Result.Failure<JournalEntryResponse>(
                new Error("journal_entry.missing_debit_account", "No se encontró una cuenta de inventario o gasto disponible en el catálogo de cuentas.", ErrorType.Validation));
        }

        // Crear asiento
        var entryYear = purchase.IssueDate.Year;
        var entryDate = purchase.IssueDate;
        var entryNumber = await _journalEntries.GetNextEntryNumberAsync(command.TenantId, entryYear, ct).ConfigureAwait(false);

        var docName = isSettlement ? "Liquidación de compra" : "Factura de compra";
        var supplierName = purchase.Supplier?.BusinessName ?? "Proveedor";
        var description = $"{docName} {purchase.InvoiceNumber} - {supplierName}";

        var lines = new List<JournalEntryLine>();
        var netSubtotal = purchase.SubtotalTaxed + purchase.SubtotalZero + purchase.SubtotalNoSubject + purchase.SubtotalExempt;

        // Línea 1: Inventario o Gasto (Debe)
        if (netSubtotal > 0)
        {
            var line1 = JournalEntryLine.Create(
                id: _idGenerator.NewId(),
                accountId: mainDebitAccount.Id,
                accountCode: mainDebitAccount.Code,
                accountName: mainDebitAccount.Name,
                debit: netSubtotal,
                credit: 0m,
                reference: $"{description} (Subtotal neto)");

            if (line1.IsFailure)
            {
                return Result.Failure<JournalEntryResponse>(line1.Error!);
            }
            lines.Add(line1.Value!);
        }

        // Línea 2: IVA Crédito Tributario (Debe)
        if (purchase.TaxAmount > 0 && taxCreditAccount != null)
        {
            var line2 = JournalEntryLine.Create(
                id: _idGenerator.NewId(),
                accountId: taxCreditAccount.Id,
                accountCode: taxCreditAccount.Code,
                accountName: taxCreditAccount.Name,
                debit: purchase.TaxAmount,
                credit: 0m,
                reference: $"IVA Crédito Tributario {purchase.TaxRate}%");

            if (line2.IsFailure)
            {
                return Result.Failure<JournalEntryResponse>(line2.Error!);
            }
            lines.Add(line2.Value!);
        }

        // Línea 3: Cuentas por Pagar Proveedor (Haber)
        var line3 = JournalEntryLine.Create(
            id: _idGenerator.NewId(),
            accountId: supplierAccount.Id,
            accountCode: supplierAccount.Code,
            accountName: supplierAccount.Name,
            debit: 0m,
            credit: purchase.TotalAmount,
            reference: $"Obligación comercial proveedor {supplierName}");

        if (line3.IsFailure)
        {
            return Result.Failure<JournalEntryResponse>(line3.Error!);
        }
        lines.Add(line3.Value!);

        var entryResult = JournalEntry.Create(
            id: _idGenerator.NewId(),
            tenantId: command.TenantId,
            entryNumber: entryNumber,
            date: entryDate,
            description: description,
            source: source,
            sourceId: purchase.Id,
            sourceReference: purchase.InvoiceNumber,
            status: JournalEntryStatus.Posted,
            lines: lines,
            createdBy: command.UserId);

        if (entryResult.IsFailure)
        {
            return Result.Failure<JournalEntryResponse>(entryResult.Error!);
        }

        var entry = entryResult.Value!;

        await _journalEntries.AddAsync(entry, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(JournalEntryResponse.FromDomain(entry));
    }
}
