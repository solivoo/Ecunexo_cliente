namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record CreateCatalogItemMatrixRequest(
    int Kind,
    string Name,
    string? Description,
    string? ModelCode,
    decimal? BasePrice,
    string VariantDimensionsJson,
    IReadOnlyList<CreateVariantChildRequest> Variants,
    string? CustomAttributesJson = null,
    Guid? FamilyId = null,
    string? HierarchyPathJson = null);

public sealed record CreateVariantChildRequest(
    string VariantTitle,
    string Sku,
    string? Barcode = null,
    decimal? BasePrice = null,
    string? CustomAttributesJson = null,
    decimal? InitialStock = null,
    Guid? InitialStockWarehouseId = null);
