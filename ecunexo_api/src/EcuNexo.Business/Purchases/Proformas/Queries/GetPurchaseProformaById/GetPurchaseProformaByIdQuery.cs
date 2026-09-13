using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Proformas.Queries.GetPurchaseProformaById;

public sealed record GetPurchaseProformaByIdQuery(Guid TenantId, Guid ProformaId) : IQuery<PurchaseProformaResponse>;
