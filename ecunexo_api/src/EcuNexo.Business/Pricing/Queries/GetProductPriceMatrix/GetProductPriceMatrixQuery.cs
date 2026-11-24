using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Queries.GetProductPriceMatrix;

public sealed record GetProductPriceMatrixQuery(
    Guid TenantId,
    int Page = 1,
    int PageSize = 25,
    string? Search = null,
    bool OnlyMissing = false,
    IReadOnlyCollection<Guid>? PriceListIds = null,
    DateOnly? Date = null) : IQuery<ProductPriceMatrixPageResponse>;
