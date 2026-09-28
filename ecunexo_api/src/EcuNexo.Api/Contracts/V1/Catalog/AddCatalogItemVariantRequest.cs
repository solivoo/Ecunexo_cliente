namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record AddCatalogItemVariantRequest(
    string VariantTitle,
    string Sku,
    decimal? BasePrice = null,
    string? CustomAttributesJson = null,
    string? Barcode = null);
