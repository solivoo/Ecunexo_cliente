using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Suppliers.Queries.GetSupplierById;

public sealed class GetSupplierByIdHandler : IQueryHandler<GetSupplierByIdQuery, SupplierResponse>
{
    private readonly ISupplierRepository _suppliers;

    public GetSupplierByIdHandler(ISupplierRepository suppliers)
    {
        _suppliers = suppliers;
    }

    public async Task<Result<SupplierResponse>> Handle(GetSupplierByIdQuery query, CancellationToken ct)
    {
        var supplier = await _suppliers.GetByIdAsync(query.TenantId, query.SupplierId, ct).ConfigureAwait(false);
        if (supplier is null)
        {
            return Result.Failure<SupplierResponse>(
                new Error("purchases.supplier.not_found", "El proveedor no fue encontrado.", ErrorType.NotFound));
        }

        return Result.Success(SupplierResponse.FromDomain(supplier));
    }
}
