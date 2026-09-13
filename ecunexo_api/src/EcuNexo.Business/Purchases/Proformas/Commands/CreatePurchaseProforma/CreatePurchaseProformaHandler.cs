using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Proformas.Commands.CreatePurchaseProforma;

public sealed class CreatePurchaseProformaHandler : ICommandHandler<CreatePurchaseProformaCommand, PurchaseProformaResponse>
{
    private readonly IPurchaseProformaRepository _proformas;
    private readonly ISupplierRepository _suppliers;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreatePurchaseProformaHandler(
        IPurchaseProformaRepository proformas,
        ISupplierRepository suppliers,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _proformas = proformas;
        _suppliers = suppliers;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PurchaseProformaResponse>> Handle(CreatePurchaseProformaCommand command, CancellationToken ct)
    {
        var supplier = await _suppliers.GetByIdAsync(command.TenantId, command.SupplierId, ct).ConfigureAwait(false);
        if (supplier is null)
        {
            return Result.Failure<PurchaseProformaResponse>(
                new Error("purchases.proforma.supplier_not_found", "El proveedor especificado no existe.", ErrorType.NotFound));
        }

        if (await _proformas.ExistsByNumberAsync(command.TenantId, command.SupplierId, command.ProformaNumber, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<PurchaseProformaResponse>(
                new Error("purchases.proforma.number_duplicate", "Ya existe una proforma con este número para el proveedor seleccionado.", ErrorType.Conflict));
        }

        if (command.Items == null || command.Items.Count == 0)
        {
            return Result.Failure<PurchaseProformaResponse>(
                new Error("purchases.proforma.items_empty", "La proforma debe incluir al menos un ítem o producto.", ErrorType.Validation));
        }

        var proformaResult = PurchaseProforma.Create(
            _idGenerator.NewId(),
            command.TenantId,
            command.SupplierId,
            command.ProformaNumber,
            command.IssueDate,
            command.ExpirationDate,
            currency: "USD",
            notes: command.Notes,
            attachmentUrl: command.AttachmentUrl,
            attachmentFileName: command.AttachmentFileName);

        if (proformaResult.IsFailure)
        {
            return Result.Failure<PurchaseProformaResponse>(proformaResult.Error!);
        }

        var proforma = proformaResult.Value!;

        foreach (var item in command.Items)
        {
            var itemResult = proforma.AddItem(
                _idGenerator.NewId(),
                item.Description,
                item.Quantity,
                item.UnitPrice,
                item.TaxRate,
                item.CatalogItemId,
                item.ExpenseTypeId);

            if (itemResult.IsFailure)
            {
                return Result.Failure<PurchaseProformaResponse>(itemResult.Error!);
            }
        }

        await _proformas.AddAsync(proforma, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(PurchaseProformaResponse.FromDomain(proforma));
    }
}
