using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Commands.CreateCatalogItemMatrix;

public sealed record CreateCatalogItemMatrixCommand(
    Guid TenantId,
    CatalogItemKind Kind,
    string Name,
    string? Description,
    string? ModelCode,
    decimal? BasePrice,
    Guid? CategoryId,
    string VariantDimensionsJson,
    IReadOnlyList<CreateVariantChildDto> Variants,
    string? CustomAttributesJson = null,
    Guid? FamilyId = null,
    string? HierarchyPathJson = null) : ICommand<CreateCatalogItemMatrixResponse>;

public sealed record CreateVariantChildDto(
    string VariantTitle,
    string Sku,
    string? Barcode = null,
    decimal? BasePrice = null,
    string? CustomAttributesJson = null,
    decimal? InitialStock = null,
    Guid? InitialStockWarehouseId = null);

public sealed record CreateCatalogItemMatrixResponse(
    Guid ParentItemId,
    int CreatedVariantsCount,
    IReadOnlyList<Guid> VariantItemIds);
