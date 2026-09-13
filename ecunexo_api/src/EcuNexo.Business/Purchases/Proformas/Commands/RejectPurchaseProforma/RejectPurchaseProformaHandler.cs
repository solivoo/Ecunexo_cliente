using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Proformas.Commands.RejectPurchaseProforma;

public sealed class RejectPurchaseProformaHandler : ICommandHandler<RejectPurchaseProformaCommand, PurchaseProformaResponse>
{
    private readonly IPurchaseProformaRepository _proformas;
    private readonly IUnitOfWork _unitOfWork;

    public RejectPurchaseProformaHandler(
        IPurchaseProformaRepository proformas,
        IUnitOfWork unitOfWork)
    {
        _proformas = proformas;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PurchaseProformaResponse>> Handle(RejectPurchaseProformaCommand command, CancellationToken ct)
    {
        var proforma = await _proformas.GetTrackedByIdAsync(command.TenantId, command.ProformaId, ct).ConfigureAwait(false);
        if (proforma is null)
        {
            return Result.Failure<PurchaseProformaResponse>(
                new Error("purchases.proforma.not_found", "La proforma de compra no fue encontrada.", ErrorType.NotFound));
        }

        var result = proforma.Reject(command.Reason);
        if (result.IsFailure)
        {
            return Result.Failure<PurchaseProformaResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(PurchaseProformaResponse.FromDomain(proforma));
    }
}
