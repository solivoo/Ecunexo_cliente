using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class UpdateCatalogItemHandlerTests
{
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly ISysSettingRepository _settings = Substitute.For<ISysSettingRepository>();
    private readonly IProductTemplateRepository _templates = Substitute.For<IProductTemplateRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IStockRepository _stocks = Substitute.For<IStockRepository>();
    private readonly IInventoryMovementRepository _movements = Substitute.For<IInventoryMovementRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly UpdateCatalogItemValidator _validator = new();

    private UpdateCatalogItemHandler CreateSut() =>
        new(
            _validator,
            _items,
            _settings,
            _templates,
            _tenants,
            _stocks,
            _movements,
            _unitOfWork);

    [Fact(DisplayName = "Reactivar una variante bloquea cuando se alcanza el límite de variantes activas")]
    public async Task Handle_ReactivatingVariantAtLimit_ReturnsForbidden()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();
        var childId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Medias Reactivación",
            null,
            "REA-01",
            3.00m,
            "[{\"name\":\"Talla\",\"values\":[\"S\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        var child = CatalogItem.CreateVariantChild(
            childId,
            parent,
            "Talla S",
            "REA-01-S",
            null,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        child.SetStatus(CatalogItemStatus.Inactive, null);

        _items.GetTrackedByIdAsync(tenantId, childId, Arg.Any<CancellationToken>())
            .Returns(child);

        var tenant = Tenant.Create(
            tenantId,
            "Empresa Small",
            new ServicePlan("Small", 3, 1),
            moduleEntitlements:
            [
                ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Small)
            ]).Value!;
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);
        _items.CountVariantsAsync(tenantId, true, Arg.Any<CancellationToken>()).Returns(100);

        var command = new UpdateCatalogItemCommand(
            tenantId,
            childId,
            child.Name,
            child.Description,
            child.Sku,
            child.BasePrice,
            child.CustomAttributesJson,
            CatalogItemStatus.Active);

        var result = await CreateSut().Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variants.active_limit_reached");
    }
}
