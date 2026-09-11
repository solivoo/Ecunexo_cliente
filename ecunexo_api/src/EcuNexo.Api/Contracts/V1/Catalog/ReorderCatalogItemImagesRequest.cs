namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record ReorderCatalogItemImagesRequest(IReadOnlyList<Guid> ImageIds);
