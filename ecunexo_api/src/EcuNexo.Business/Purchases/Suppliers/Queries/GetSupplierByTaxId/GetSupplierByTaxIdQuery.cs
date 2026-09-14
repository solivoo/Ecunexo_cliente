using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Suppliers.Queries.GetSupplierByTaxId;

public sealed record GetSupplierByTaxIdQuery(
    Guid TenantId,
    string TaxId) : IQuery<SupplierResponse?>;

public sealed class GetSupplierByTaxIdHandler : IQueryHandler<GetSupplierByTaxIdQuery, SupplierResponse?>
{
    private readonly ISupplierRepository _suppliers;

    public GetSupplierByTaxIdHandler(ISupplierRepository suppliers)
    {
        _suppliers = suppliers;
    }

    public async Task<Result<SupplierResponse?>> Handle(GetSupplierByTaxIdQuery query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query.TaxId))
        {
            return Result.Success<SupplierResponse?>(null);
        }

        var supplier = await _suppliers.GetByTaxIdAsync(query.TenantId, query.TaxId.Trim(), ct).ConfigureAwait(false);
        return Result.Success<SupplierResponse?>(supplier is not null ? SupplierResponse.FromDomain(supplier) : null);
    }
}
