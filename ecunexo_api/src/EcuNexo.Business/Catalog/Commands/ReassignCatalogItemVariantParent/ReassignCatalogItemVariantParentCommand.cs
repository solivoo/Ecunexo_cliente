using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.ReassignCatalogItemVariantParent;

public sealed record ReassignCatalogItemVariantParentCommand(
    Guid TenantId,
    Guid VariantItemId,
    Guid? TargetParentItemId,
    string Reason,
    Guid? CurrentUserId = null) : ICommand<ReassignCatalogItemVariantParentResponse>;

public sealed record ReassignCatalogItemVariantParentResponse(
    Guid ItemId,
    Guid? PreviousParentId,
    Guid? TargetParentId,
    string Reason,
    string ItemSku,
    string ItemName);
