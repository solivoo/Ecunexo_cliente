using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.SetCatalogItemStorefrontVisibility;

public sealed record SetCatalogItemStorefrontVisibilityCommand(Guid TenantId, Guid ItemId, bool Hidden)
    : ICommand<SetCatalogItemStorefrontVisibilityResponse>;

public sealed record SetCatalogItemStorefrontVisibilityResponse(Guid ItemId, Guid TenantId, bool Hidden);
