using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.ReorderCatalogItemImages;

public sealed record ReorderCatalogItemImagesCommand(
    Guid TenantId,
    Guid ItemId,
    IReadOnlyList<Guid> OrderedImageIds,
    Guid? UserId = null) : ICommand<ReorderCatalogItemImagesResponse>;

public sealed record ReorderCatalogItemImagesResponse(IReadOnlyList<Guid> OrderedImageIds);
