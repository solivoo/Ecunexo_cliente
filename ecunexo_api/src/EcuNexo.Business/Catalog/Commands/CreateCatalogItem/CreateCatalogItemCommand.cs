using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Commands.CreateCatalogItem;

public sealed record CreateCatalogItemCommand(
    Guid TenantId,
    CatalogItemKind Kind,
    string Name,
    string? Description = null,
    string? Sku = null,
    decimal? BasePrice = null,
    string? CustomAttributesJson = null,
    Guid? FamilyId = null,
    string? HierarchyPathJson = null) : ICommand<CreateCatalogItemResponse>;

public sealed record CreateCatalogItemResponse(Guid ItemId, Guid TenantId);
