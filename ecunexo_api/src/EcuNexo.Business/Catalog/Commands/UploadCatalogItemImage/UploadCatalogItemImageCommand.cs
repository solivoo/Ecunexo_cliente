using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.UploadCatalogItemImage;

public sealed record UploadCatalogItemImageCommand(
    Guid TenantId,
    Guid ItemId,
    Stream FileStream,
    string FileName,
    string ContentType,
    string? AltText = null,
    bool? SetAsMain = null,
    Guid? UserId = null) : ICommand<CatalogItemImageResponse>;
