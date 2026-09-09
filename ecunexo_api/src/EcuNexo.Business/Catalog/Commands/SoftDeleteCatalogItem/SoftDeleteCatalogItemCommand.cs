using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.SoftDeleteCatalogItem;

public sealed record SoftDeleteCatalogItemCommand(Guid TenantId, Guid ItemId)
    : ICommand<SoftDeleteCatalogItemResponse>;

public sealed record SoftDeleteCatalogItemResponse(Guid ItemId, Guid TenantId);
