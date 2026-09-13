using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Suppliers.Queries.GetSupplierById;

public sealed record GetSupplierByIdQuery(Guid TenantId, Guid SupplierId) : IQuery<SupplierResponse>;
