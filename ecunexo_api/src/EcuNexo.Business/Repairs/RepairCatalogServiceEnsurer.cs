using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs;

/// <summary>
/// Asegura que existan los 3 servicios REP-N1/N2/N3 activos en el catálogo del tenant.
/// </summary>
public sealed class RepairCatalogServiceEnsurer
{
    private readonly ICatalogItemRepository _catalogItems;
    private readonly IUnitOfWork _unitOfWork;

    public RepairCatalogServiceEnsurer(ICatalogItemRepository catalogItems, IUnitOfWork unitOfWork)
    {
        _catalogItems = catalogItems;
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyDictionary<DamageLevel, CatalogItem>> EnsureAsync(
        Guid tenantId,
        CancellationToken ct)
    {
        var services = await _catalogItems
            .ListActiveByTenantAsync(tenantId, CatalogItemKind.Service, CatalogItemStatus.Active, ct)
            .ConfigureAwait(false);

        var bySku = services
            .Where(s => !string.IsNullOrWhiteSpace(s.Sku))
            .GroupBy(s => s.Sku!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var result = new Dictionary<DamageLevel, CatalogItem>();
        var created = false;

        foreach (var level in new[] { DamageLevel.Level1, DamageLevel.Level2, DamageLevel.Level3 })
        {
            var sku = RepairCatalogServiceCodes.SkuFor(level);
            if (bySku.TryGetValue(sku, out var existing))
            {
                result[level] = existing;
                continue;
            }

            var create = CatalogItem.Create(
                Guid.NewGuid(),
                tenantId,
                CatalogItemKind.Service,
                RepairCatalogServiceCodes.NameFor(level),
                description: "Servicio de reacondicionamiento B2B generado automáticamente para facturación de despachos.",
                sku: sku,
                basePrice: null,
                categoryId: null,
                customAttributesJson: null,
                categorySchemaJson: "{}");

            if (create.IsFailure)
            {
                continue;
            }

            await _catalogItems.AddAsync(create.Value!, ct).ConfigureAwait(false);
            result[level] = create.Value!;
            created = true;
        }

        if (created)
        {
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        }

        return result;
    }
}
