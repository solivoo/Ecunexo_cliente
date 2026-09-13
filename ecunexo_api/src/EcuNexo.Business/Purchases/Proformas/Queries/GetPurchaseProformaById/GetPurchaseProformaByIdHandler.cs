using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Proformas.Queries.GetPurchaseProformaById;

public sealed class GetPurchaseProformaByIdHandler : IQueryHandler<GetPurchaseProformaByIdQuery, PurchaseProformaResponse>
{
    private readonly IPurchaseProformaRepository _proformas;

    public GetPurchaseProformaByIdHandler(IPurchaseProformaRepository proformas)
    {
        _proformas = proformas;
    }

    public async Task<Result<PurchaseProformaResponse>> Handle(GetPurchaseProformaByIdQuery query, CancellationToken ct)
    {
        var proforma = await _proformas.GetByIdAsync(query.TenantId, query.ProformaId, ct).ConfigureAwait(false);
        if (proforma is null)
        {
            return Result.Failure<PurchaseProformaResponse>(
                new Error("purchases.proforma.not_found", "La proforma de compra no fue encontrada.", ErrorType.NotFound));
        }

        return Result.Success(PurchaseProformaResponse.FromDomain(proforma));
    }
}
