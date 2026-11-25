using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontColors;

public sealed record ListStorefrontColorsQuery(Guid TenantId) : IQuery<IReadOnlyList<StorefrontColorDto>>;
