namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record ReassignCatalogItemVariantParentRequest(
    Guid? TargetParentItemId,
    string Reason);
