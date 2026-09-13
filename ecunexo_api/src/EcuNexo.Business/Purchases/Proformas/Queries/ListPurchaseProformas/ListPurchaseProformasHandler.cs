using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Proformas.Queries.ListPurchaseProformas;

public sealed class ListPurchaseProformasHandler : IQueryHandler<ListPurchaseProformasQuery, IReadOnlyList<PurchaseProformaResponse>>
{
    private readonly IPurchaseProformaRepository _proformas;

    public ListPurchaseProformasHandler(IPurchaseProformaRepository proformas)
    {
        _proformas = proformas;
    }

    public async Task<Result<IReadOnlyList<PurchaseProformaResponse>>> Handle(ListPurchaseProformasQuery query, CancellationToken ct)
    {
        var list = await _proformas.ListAsync(
            query.TenantId,
            query.SupplierId,
            query.Status,
            query.From,
            query.To,
            ct).ConfigureAwait(false);

        IReadOnlyList<PurchaseProformaResponse> response = list.Select(PurchaseProformaResponse.FromDomain).ToList();
        return Result.Success(response);
    }
}
