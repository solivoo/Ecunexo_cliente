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

    [Fact(DisplayName = "UpdateCatalogItem sincroniza hierarchyPathJson al asignar y limpiar CategoryId")]
    public async Task Handle_SyncsHierarchyPathWithCategoryOnSave()
    {
        var tenantId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();
        var categoryId = Guid.CreateVersion7();
        var category = Category.Create(categoryId, tenantId, "Deportivos").Value!;

        var item = CatalogItem.Create(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Pro",
            null,
            "CALC-PRO-01",
            4.5m,
            null,
            CatalogAttributeSchema.EmptyArrayJson,
            hierarchyPathJson: """[{"level":"Familia","name":"Material","value":"Algodón"}]""").Value!;

        _items.GetTrackedByIdAsync(tenantId, itemId, Arg.Any<CancellationToken>())
            .Returns(item);

        var categoriesRepo = Substitute.For<ICategoryRepository>();
        categoriesRepo.GetActiveByIdAsync(tenantId, categoryId, Arg.Any<CancellationToken>())
            .Returns(category);

        var sut = new UpdateCatalogItemHandler(
            _validator,
            _items,
            _settings,
            _templates,
            _tenants,
            _stocks,
            _movements,
            _unitOfWork,
            categoriesRepo);

        var assignResult = await sut.Handle(
            new UpdateCatalogItemCommand(
                tenantId,
                itemId,
                item.Name,
                item.Description,
                item.Sku,
                item.BasePrice,
                item.CustomAttributesJson,
                HierarchyPathJson: item.HierarchyPathJson,
                CategoryId: categoryId),
            CancellationToken.None);

        assignResult.IsSuccess.Should().BeTrue();
        item.CategoryId.Should().Be(categoryId);
        item.HierarchyPathJson.Should().Contain("Clasificaci");
        item.HierarchyPathJson.Should().Contain("Deportivos");
        item.HierarchyPathJson.Should().Contain("Algod");

        var clearResult = await sut.Handle(
            new UpdateCatalogItemCommand(
                tenantId,
                itemId,
                item.Name,
                item.Description,
                item.Sku,
                item.BasePrice,
                item.CustomAttributesJson,
                HierarchyPathJson: item.HierarchyPathJson,
                CategoryId: null),
            CancellationToken.None);

        clearResult.IsSuccess.Should().BeTrue();
        item.CategoryId.Should().BeNull();
        item.HierarchyPathJson.Should().NotContain("Deportivos");
        item.HierarchyPathJson.Should().Contain("Algod");
    }
}
