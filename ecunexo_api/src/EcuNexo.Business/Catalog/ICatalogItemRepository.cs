using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog;

public interface ICatalogItemRepository
{
    Task AddAsync(CatalogItem item, CancellationToken ct);

    Task<IReadOnlyList<CatalogItem>> ListActiveByTenantAsync(
        Guid tenantId,
        CatalogItemKind? kind,
        CatalogItemStatus? status,
        CancellationToken ct);

    Task<IReadOnlyList<CatalogItem>> ListActiveByTenantAsync(
        Guid tenantId,
        CatalogItemKind? kind,
        CancellationToken ct) =>
        ListActiveByTenantAsync(tenantId, kind, null, ct);

    Task<CatalogItem?> GetActiveByIdAsync(Guid tenantId, Guid itemId, CancellationToken ct);

    Task<CatalogItem?> GetTrackedByIdAsync(Guid tenantId, Guid itemId, CancellationToken ct);

    /// <summary>Ítems (activos o no) con sus imágenes, para mostrar evidencias de pedidos históricos.</summary>
    Task<IReadOnlyList<CatalogItem>> GetByIdsWithImagesAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> ids,
        CancellationToken ct);

    Task<IReadOnlyList<CatalogItem>> GetActiveByIdsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> ids,
        CancellationToken ct);

    Task<bool> SkuExistsIgnoreCaseAsync(Guid tenantId, string sku, Guid? excludeId, CancellationToken ct);
    Task<bool> BarcodeExistsIgnoreCaseAsync(Guid tenantId, string barcode, Guid? excludeId, CancellationToken ct);

    Task<int> CountVariantsAsync(Guid tenantId, bool onlyActive, CancellationToken ct);

    Task<IReadOnlyDictionary<Guid, int>> CountItemsByFamilyAsync(Guid tenantId, CancellationToken ct);

    Task<bool> IsAttributeTemplateInUseAsync(Guid tenantId, string templateName, CancellationToken ct);
    Task<HashSet<string>> GetInUseAttributeTemplateNamesAsync(Guid tenantId, CancellationToken ct);

    /// <summary>
    /// Renombra la clave del atributo en todos los ítems activos del tenant.
    /// Devuelve los ids de los ítems modificados.
    /// </summary>
    Task<IReadOnlyCollection<Guid>> RenameAttributeKeyAsync(
        Guid tenantId,
        string oldName,
        string newName,
        Guid? updatedBy,
        CancellationToken ct);

    /// <summary>
    /// Renombra un valor del atributo en todos los ítems activos del tenant.
    /// Devuelve los ids de los ítems modificados.
    /// </summary>
    Task<IReadOnlyCollection<Guid>> RenameAttributeValueAsync(
        Guid tenantId,
        string attributeName,
        string oldValue,
        string newValue,
        bool isMultiValue,
        bool renameImageGroups,
        Guid? updatedBy,
        CancellationToken ct);
}
