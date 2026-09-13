using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Suppliers.Queries.ListSuppliers;

public sealed class ListSuppliersHandler : IQueryHandler<ListSuppliersQuery, IReadOnlyList<SupplierResponse>>
{
    private readonly ISupplierRepository _suppliers;

    public ListSuppliersHandler(ISupplierRepository suppliers)
    {
        _suppliers = suppliers;
    }

    public async Task<Result<IReadOnlyList<SupplierResponse>>> Handle(ListSuppliersQuery query, CancellationToken ct)
    {
        var list = await _suppliers.ListAsync(query.TenantId, query.Search, query.ActiveOnly, ct).ConfigureAwait(false);
        IReadOnlyList<SupplierResponse> response = list.Select(SupplierResponse.FromDomain).ToList();
        return Result.Success(response);
    }
}
