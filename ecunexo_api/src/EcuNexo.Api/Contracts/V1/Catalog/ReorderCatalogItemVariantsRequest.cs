namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record ReorderCatalogItemVariantsRequest(IReadOnlyList<Guid> VariantIds);
