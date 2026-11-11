using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Queries.ListCategories;

namespace EcuNexo.Business.Catalog.Queries.GetCategoryById;

public sealed record GetCategoryByIdQuery(Guid TenantId, Guid CategoryId) : IQuery<CategoryListItemResponse>;
