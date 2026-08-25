using EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record UpdateCatalogItemRequest(
    string Name,
    string? Description = null,
    string? Sku = null,
    decimal? BasePrice = null,
    Guid? CategoryId = null,
    string? CustomAttributesJson = null,
    CatalogItemStatus? Status = null,
    CatalogItemKind? Kind = null)
{
    public UpdateCatalogItemCommand ToCommand(Guid tenantId, Guid itemId) =>
        new(tenantId, itemId, Name, Description, Sku, BasePrice, CategoryId, CustomAttributesJson, Status, Kind);
}
