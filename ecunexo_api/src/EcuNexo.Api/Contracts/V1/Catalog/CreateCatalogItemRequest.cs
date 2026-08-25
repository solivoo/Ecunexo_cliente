using EcuNexo.Business.Catalog.Commands.CreateCatalogItem;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record CreateCatalogItemRequest(
    CatalogItemKind Kind,
    string Name,
    string? Description = null,
    string? Sku = null,
    decimal? BasePrice = null,
    Guid? CategoryId = null,
    string? CustomAttributesJson = null)
{
    public CreateCatalogItemCommand ToCommand(Guid tenantId) =>
        new(tenantId, Kind, Name, Description, Sku, BasePrice, CategoryId, CustomAttributesJson);
}
