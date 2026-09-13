using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Suppliers.Queries.ListSuppliers;

public sealed record ListSuppliersQuery(
    Guid TenantId,
    string? Search,
    bool? ActiveOnly) : IQuery<IReadOnlyList<SupplierResponse>>;
