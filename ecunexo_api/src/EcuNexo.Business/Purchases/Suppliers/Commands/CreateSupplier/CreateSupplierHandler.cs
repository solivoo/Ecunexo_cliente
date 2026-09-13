using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Suppliers.Commands.CreateSupplier;

public sealed class CreateSupplierHandler : ICommandHandler<CreateSupplierCommand, SupplierResponse>
{
    private readonly ISupplierRepository _suppliers;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreateSupplierHandler(
        ISupplierRepository suppliers,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _suppliers = suppliers;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SupplierResponse>> Handle(CreateSupplierCommand command, CancellationToken ct)
    {
        if (await _suppliers.ExistsByTaxIdAsync(command.TenantId, command.TaxId, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<SupplierResponse>(
                new Error("purchases.supplier.tax_id_duplicate", "Ya existe un proveedor registrado con esta identificación fiscal o RUC.", ErrorType.Conflict));
        }

        if (await _suppliers.ExistsByBusinessNameAsync(command.TenantId, command.BusinessName, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<SupplierResponse>(
                new Error("purchases.supplier.business_name_duplicate", "Ya existe un proveedor con esta razón social.", ErrorType.Conflict));
        }

        var supplierResult = Supplier.Create(
            _idGenerator.NewId(),
            command.TenantId,
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
            command.CreatedBy);

        if (supplierResult.IsFailure)
        {
            return Result.Failure<SupplierResponse>(supplierResult.Error!);
        }

        var supplier = supplierResult.Value!;
        await _suppliers.AddAsync(supplier, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(SupplierResponse.FromDomain(supplier));
    }
}
