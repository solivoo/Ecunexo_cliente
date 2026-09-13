using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Suppliers.Commands.DeleteSupplier;

public sealed class DeleteSupplierHandler : ICommandHandler<DeleteSupplierCommand, bool>
{
    private readonly ISupplierRepository _suppliers;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteSupplierHandler(
        ISupplierRepository suppliers,
        IUnitOfWork unitOfWork)
    {
        _suppliers = suppliers;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteSupplierCommand command, CancellationToken ct)
    {
        var supplier = await _suppliers.GetTrackedByIdAsync(command.TenantId, command.SupplierId, ct).ConfigureAwait(false);
        if (supplier is null)
        {
            return Result.Failure<bool>(
                new Error("purchases.supplier.not_found", "El proveedor no fue encontrado.", ErrorType.NotFound));
        }

        supplier.SoftDelete();
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(true);
    }
}
