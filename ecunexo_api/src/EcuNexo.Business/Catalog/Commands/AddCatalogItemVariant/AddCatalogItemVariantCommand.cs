using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.AddCatalogItemVariant;

public sealed record AddCatalogItemVariantCommand(
    Guid TenantId,
    Guid ParentItemId,
    string VariantTitle,
    string Sku,
    decimal? BasePrice = null,
    string? CustomAttributesJson = null,
    string? Barcode = null) : ICommand<AddCatalogItemVariantResponse>;

public sealed record AddCatalogItemVariantResponse(
    Guid VariantItemId,
    Guid ParentItemId,
    string Sku,
    string Name);
