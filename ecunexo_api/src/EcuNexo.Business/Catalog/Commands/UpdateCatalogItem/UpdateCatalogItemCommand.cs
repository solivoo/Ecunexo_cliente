using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;

public sealed record UpdateCatalogItemCommand(
    Guid TenantId,
    Guid ItemId,
    string Name,
    string? Description = null,
    string? Sku = null,
    decimal? BasePrice = null,
    Guid? CategoryId = null,
    string? CustomAttributesJson = null,
    CatalogItemStatus? Status = null,
    CatalogItemKind? Kind = null) : ICommand<UpdateCatalogItemResponse>;

public sealed record UpdateCatalogItemResponse(Guid ItemId, Guid TenantId);
