using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Proformas.Queries.ListPurchaseProformas;

public sealed record ListPurchaseProformasQuery(
    Guid TenantId,
    Guid? SupplierId,
    PurchaseProformaStatus? Status,
    DateOnly? From,
    DateOnly? To) : IQuery<IReadOnlyList<PurchaseProformaResponse>>;
