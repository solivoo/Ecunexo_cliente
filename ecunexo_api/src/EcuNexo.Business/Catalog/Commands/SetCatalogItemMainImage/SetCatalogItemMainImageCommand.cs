using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.SetCatalogItemMainImage;

public sealed record SetCatalogItemMainImageCommand(
    Guid TenantId,
    Guid ItemId,
    Guid ImageId,
    Guid? UserId = null) : ICommand<SetCatalogItemMainImageResponse>;

public sealed record SetCatalogItemMainImageResponse(Guid ImageId, bool IsMain = true);
