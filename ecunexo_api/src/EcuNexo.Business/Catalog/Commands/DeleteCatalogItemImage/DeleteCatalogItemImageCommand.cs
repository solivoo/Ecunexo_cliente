using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.DeleteCatalogItemImage;

public sealed record DeleteCatalogItemImageCommand(
    Guid TenantId,
    Guid ItemId,
    Guid ImageId,
    Guid? UserId = null) : ICommand<DeleteCatalogItemImageResponse>;

public sealed record DeleteCatalogItemImageResponse(Guid ImageId, bool Success = true);
