using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.UpdateCatalogItemImageAltText;

public sealed record UpdateCatalogItemImageAltTextCommand(
    Guid TenantId,
    Guid ItemId,
    Guid ImageId,
    string? AltText,
    Guid? UserId = null) : ICommand<UpdateCatalogItemImageAltTextResponse>;

public sealed record UpdateCatalogItemImageAltTextResponse(Guid ImageId, string? AltText);
