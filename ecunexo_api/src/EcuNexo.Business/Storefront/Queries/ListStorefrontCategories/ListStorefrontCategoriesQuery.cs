using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontCategories;

public sealed record ListStorefrontCategoriesQuery(Guid TenantId)
    : IQuery<IReadOnlyList<StorefrontCategoryDto>>;
