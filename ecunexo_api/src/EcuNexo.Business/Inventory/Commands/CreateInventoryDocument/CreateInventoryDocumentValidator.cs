using EcuNexo.Core.Inventory;
using FluentValidation;

namespace EcuNexo.Business.Inventory.Commands.CreateInventoryDocument;

public sealed class CreateInventoryDocumentValidator : AbstractValidator<CreateInventoryDocumentCommand>
{
    public CreateInventoryDocumentValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.WarehouseId).NotEmpty();
        RuleFor(x => x.DocumentType).IsInEnum();
        RuleFor(x => x.DestinationWarehouseId)
            .NotEmpty()
            .When(x => x.DocumentType == InventoryDocumentType.Transfer);
        RuleFor(x => x.DestinationWarehouseId)
            .Empty()
            .When(x => x.DocumentType != InventoryDocumentType.Transfer);
        RuleFor(x => x.DestinationWarehouseId)
            .NotEqual(x => x.WarehouseId)
            .When(x => x.DocumentType == InventoryDocumentType.Transfer && x.DestinationWarehouseId.HasValue);
        RuleFor(x => x.Notes)
            .NotEmpty()
            .WithMessage("El ajuste requiere una nota con el motivo del conteo.")
            .When(x => x.DocumentType == InventoryDocumentType.Adjustment);
        RuleFor(x => x.Notes)
            .MaximumLength(InventoryDocument.NotesMaxLength)
            .When(x => x.Notes is not null);
        RuleFor(x => x.ReceiptOrigin)
            .Null()
            .When(x => x.DocumentType != InventoryDocumentType.Receipt);
        RuleFor(x => x.SourceDocumentNumber)
            .Empty()
            .When(x => x.DocumentType != InventoryDocumentType.Receipt
                || x.ReceiptOrigin != InventoryReceiptOrigin.Purchase);
        RuleFor(x => x.SourceDocumentNumber)
            .NotEmpty()
            .Matches(@"^\d{3}-\d{3}-\d{9}$")
            .WithMessage("El número de factura debe ser 001-001-000000123.")
            .When(x => x.DocumentType == InventoryDocumentType.Receipt
                && x.ReceiptOrigin == InventoryReceiptOrigin.Purchase);
        RuleFor(x => x.Lines).NotEmpty();
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.CatalogItemId).NotEmpty();
        });
        RuleForEach(x => x.Lines)
            .ChildRules(line => line.RuleFor(l => l.Quantity).GreaterThan(0))
            .When(x => x.DocumentType != InventoryDocumentType.Adjustment);
        RuleForEach(x => x.Lines)
            .ChildRules(line => line.RuleFor(l => l.Quantity).GreaterThanOrEqualTo(0))
            .When(x => x.DocumentType == InventoryDocumentType.Adjustment);
    }
}
