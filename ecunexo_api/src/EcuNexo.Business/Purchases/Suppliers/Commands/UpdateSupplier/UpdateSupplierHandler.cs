using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Suppliers.Commands.UpdateSupplier;

public sealed class UpdateSupplierHandler : ICommandHandler<UpdateSupplierCommand, SupplierResponse>
{
    private readonly ISupplierRepository _suppliers;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateSupplierHandler(
        ISupplierRepository suppliers,
        IUnitOfWork unitOfWork)
    {
        _suppliers = suppliers;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SupplierResponse>> Handle(UpdateSupplierCommand command, CancellationToken ct)
    {
        var supplier = await _suppliers.GetTrackedByIdAsync(command.TenantId, command.SupplierId, ct).ConfigureAwait(false);
        if (supplier is null)
        {
            return Result.Failure<SupplierResponse>(
                new Error("purchases.supplier.not_found", "El proveedor no fue encontrado.", ErrorType.NotFound));
        }

        if (await _suppliers.ExistsByTaxIdAsync(command.TenantId, command.TaxId, command.SupplierId, ct).ConfigureAwait(false))
        {
            return Result.Failure<SupplierResponse>(
                new Error("purchases.supplier.tax_id_duplicate", "Ya existe otro proveedor registrado con esta identificación fiscal o RUC.", ErrorType.Conflict));
        }

        if (await _suppliers.ExistsByBusinessNameAsync(command.TenantId, command.BusinessName, command.SupplierId, ct).ConfigureAwait(false))
        {
            return Result.Failure<SupplierResponse>(
                new Error("purchases.supplier.business_name_duplicate", "Ya existe otro proveedor con esta razón social.", ErrorType.Conflict));
        }

        var updateResult = supplier.Update(
            command.BusinessName,
            command.TaxId,
            command.IdentificationType,
            command.TaxRegime,
            command.TradeName,
            command.IsRetentionAgent,
            command.ResolutionNumber,
            command.ContactEmail,
            command.ContactPhone,
            command.Address,
            command.ContactPerson,
            command.CreditDays,
            command.CreditLimit,
            command.BankName,
            command.BankAccountType,
            command.BankAccountNumber,
            command.Notes,
            command.UpdatedBy);

        if (updateResult.IsFailure)
        {
            return Result.Failure<SupplierResponse>(updateResult.Error!);
        }

        if (command.IsActive && !supplier.IsActive)
        {
            supplier.Activate();
        }
        else if (!command.IsActive && supplier.IsActive)
        {
            supplier.Deactivate();
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(SupplierResponse.FromDomain(supplier));
    }
}
