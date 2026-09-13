using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Commands.CreatePurchase;

public sealed record CreatePurchaseLineInput(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount = 0m,
    decimal TaxRate = 15m,
    string? ItemCode = null,
    Guid? CatalogItemId = null,
    Guid? WarehouseId = null,
    bool AffectsInventory = false);

public sealed record CreatePurchaseCommand(
    Guid TenantId,
    Guid SupplierId,
    string InvoiceNumber,
    DateOnly IssueDate,
    string DocumentType = "01",
    string? AuthorizationNumber = null,
    Guid? ExpenseTypeId = null,
    string SriSustentoCode = "01",
    decimal SubtotalZero = 0m,
    decimal SubtotalTaxed = 0m,
    decimal SubtotalNoSubject = 0m,
    decimal SubtotalExempt = 0m,
    decimal TaxRate = 15m,
    decimal TaxAmount = 0m,
    decimal TotalDiscount = 0m,
    decimal TotalAmount = 0m,
    string? PaymentMethodCode = null,
    int CreditDays = 0,
    Guid? ProformaId = null,
    string? RawXml = null,
    string? Notes = null,
    IReadOnlyList<CreatePurchaseLineInput>? Lines = null,
    Guid? CreatedBy = null) : ICommand<CreatePurchaseResponse>;

public sealed record CreatePurchaseResponse(
    Guid PurchaseId,
    string InvoiceNumber,
    PurchaseStatus Status,
    decimal TotalAmount);

public sealed class CreatePurchaseHandler : ICommandHandler<CreatePurchaseCommand, CreatePurchaseResponse>
{
    private readonly IPurchaseRepository _purchases;
    private readonly ISupplierRepository _suppliers;
    private readonly IPurchaseProformaRepository _proformas;
    private readonly IExpenseTypeRepository _expenseTypes;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreatePurchaseHandler(
        IPurchaseRepository purchases,
        ISupplierRepository suppliers,
        IPurchaseProformaRepository proformas,
        IExpenseTypeRepository expenseTypes,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _purchases = purchases;
        _suppliers = suppliers;
        _proformas = proformas;
        _expenseTypes = expenseTypes;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreatePurchaseResponse>> Handle(
        CreatePurchaseCommand command,
        CancellationToken ct)
    {
        // 1. Validar Proveedor
        var supplier = await _suppliers.GetByIdAsync(command.TenantId, command.SupplierId, ct).ConfigureAwait(false);
        if (supplier is null)
        {
            return Result.Failure<CreatePurchaseResponse>(
                new Error("purchases.supplier.not_found", "El proveedor especificado no existe.", ErrorType.NotFound));
        }

        // 2. Validar que no exista ya la misma factura registrada para este proveedor
        var normalizedInvoiceNumber = command.InvoiceNumber.Trim();
        if (normalizedInvoiceNumber.Length == 15 && normalizedInvoiceNumber.All(char.IsDigit))
        {
            normalizedInvoiceNumber = $"{normalizedInvoiceNumber[..3]}-{normalizedInvoiceNumber.Substring(3, 3)}-{normalizedInvoiceNumber[6..]}";
        }

        var exists = await _purchases.ExistsByInvoiceNumberAsync(
            command.TenantId,
            command.SupplierId,
            normalizedInvoiceNumber,
            null,
            ct).ConfigureAwait(false);

        if (exists)
        {
            return Result.Failure<CreatePurchaseResponse>(
                new Error("purchases.invoice_number.duplicate", $"Ya existe una factura registrada con el número '{normalizedInvoiceNumber}' para este proveedor.", ErrorType.Conflict));
        }

        // 3. Validar tipo de gasto / sustento si se envió
        var sustento = command.SriSustentoCode;
        if (command.ExpenseTypeId.HasValue)
        {
            var expenseType = await _expenseTypes.GetByIdAsync(command.TenantId, command.ExpenseTypeId.Value, ct).ConfigureAwait(false);
            if (expenseType is not null)
            {
                sustento = expenseType.SriSustentoCode;
            }
        }

        // 4. Crear agregado Purchase
        var purchaseId = _idGenerator.NewId();
        var purchaseResult = Purchase.Create(
            id: purchaseId,
            tenantId: command.TenantId,
            supplierId: command.SupplierId,
            invoiceNumber: command.InvoiceNumber,
            issueDate: command.IssueDate,
            documentType: command.DocumentType,
            authorizationNumber: command.AuthorizationNumber,
            expenseTypeId: command.ExpenseTypeId,
            sriSustentoCode: sustento,
            subtotalZero: command.SubtotalZero,
            subtotalTaxed: command.SubtotalTaxed,
            subtotalNoSubject: command.SubtotalNoSubject,
            subtotalExempt: command.SubtotalExempt,
            taxRate: command.TaxRate,
            taxAmount: command.TaxAmount,
            totalDiscount: command.TotalDiscount,
            totalAmount: command.TotalAmount,
            paymentMethodCode: command.PaymentMethodCode,
            creditDays: command.CreditDays,
            proformaId: command.ProformaId,
            rawXml: command.RawXml,
            notes: command.Notes,
            createdBy: command.CreatedBy);

        if (purchaseResult.IsFailure)
        {
            return Result.Failure<CreatePurchaseResponse>(purchaseResult.Error!);
        }

        var purchase = purchaseResult.Value!;

        // 5. Agregar líneas si se proporcionaron
        if (command.Lines is not null)
        {
            foreach (var line in command.Lines)
            {
                var itemResult = PurchaseItem.Create(
                    id: _idGenerator.NewId(),
                    purchaseId: purchaseId,
                    description: line.Description,
                    quantity: line.Quantity,
                    unitPrice: line.UnitPrice,
                    discount: line.Discount,
                    taxRate: line.TaxRate,
                    itemCode: line.ItemCode,
                    catalogItemId: line.CatalogItemId,
                    warehouseId: line.WarehouseId,
                    affectsInventory: line.AffectsInventory);

                if (itemResult.IsFailure)
                {
                    return Result.Failure<CreatePurchaseResponse>(itemResult.Error!);
                }

                purchase.AddItem(itemResult.Value!);
            }
        }

        // Si la compra es 100% de servicios o gastos operativos (ninguna línea afecta inventario físico),
        // pasa directamente a estado Invoiced (Facturado), sin requerir recepción física en bodega.
        if (purchase.Items.Count > 0 && purchase.Items.All(i => !i.AffectsInventory))
        {
            purchase.MarkAsInvoiced(command.CreatedBy);
        }

        // 6. Si vino de una Proforma, marcar la proforma como convertida a compra
        if (command.ProformaId.HasValue)
        {
            var proforma = await _proformas.GetTrackedByIdAsync(command.TenantId, command.ProformaId.Value, ct).ConfigureAwait(false);
            if (proforma is not null)
            {
                proforma.MarkConvertedToPurchase(purchaseId, command.CreatedBy);
            }
        }

        await _purchases.AddAsync(purchase, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreatePurchaseResponse(
            PurchaseId: purchase.Id,
            InvoiceNumber: purchase.InvoiceNumber,
            Status: purchase.Status,
            TotalAmount: purchase.TotalAmount));
    }
}
