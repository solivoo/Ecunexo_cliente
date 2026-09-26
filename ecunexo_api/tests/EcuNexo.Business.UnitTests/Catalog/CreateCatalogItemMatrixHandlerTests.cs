using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.CreateCatalogItemMatrix;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class CreateCatalogItemMatrixHandlerTests
{
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly ISysSettingRepository _settings = Substitute.For<ISysSettingRepository>();
    private readonly IProductTemplateRepository _templates = Substitute.For<IProductTemplateRepository>();
    private readonly IStockRepository _stocks = Substitute.For<IStockRepository>();
    private readonly IWarehouseRepository _warehouses = Substitute.For<IWarehouseRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly CreateCatalogItemMatrixValidator _validator = new();

    private CreateCatalogItemMatrixHandler CreateSut() =>
        new(
            _validator,
            _idGenerator,
            _tenants,
            _items,
            _settings,
            _templates,
            _stocks,
            _warehouses,
            _unitOfWork);

    [Fact(DisplayName = "Crear producto matriz con variantes genera padre e hijos en BD")]
    public async Task Handle_ValidMatrixWithVariants_Succeeds()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _idGenerator.NewId().Returns(Guid.CreateVersion7());
        _items.SkuExistsIgnoreCaseAsync(tenantId, Arg.Any<string>(), null, Arg.Any<CancellationToken>())
            .Returns(false);

        var command = new CreateCatalogItemMatrixCommand(
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Deportivo Algodón",
            "Calcetines transpirables",
            ModelCode: "CALC-01",
            BasePrice: 3.50m,
            VariantDimensionsJson: "[{\"name\": \"Talla\", \"values\": [\"35-38\", \"39-41\"]}]",
            Variants:
            [
                new CreateVariantChildDto("35-38", "CALC-01-3538", BasePrice: 3.50m, CustomAttributesJson: "{\"talla\": \"35-38\"}"),
                new CreateVariantChildDto("39-41", "CALC-01-3941", BasePrice: 3.50m, CustomAttributesJson: "{\"talla\": \"39-41\"}")
            ]);

        var sut = CreateSut();

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        result.Value!.CreatedVariantsCount.Should().Be(2);
        result.Value.VariantItemIds.Should().HaveCount(2);

        await _items.Received(3).AddAsync(Arg.Any<CatalogItem>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Crear producto matriz rechaza SKUs duplicados en el mismo payload")]
    public async Task Handle_DuplicateSkuInPayload_ReturnsError()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var command = new CreateCatalogItemMatrixCommand(
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín",
            null,
            ModelCode: null,
            BasePrice: 2.0m,
            VariantDimensionsJson: "[{\"name\": \"Talla\", \"values\": [\"S\", \"M\"]}]",
            Variants:
            [
                new CreateVariantChildDto("S", "SKU-REPETIDO"),
                new CreateVariantChildDto("M", "SKU-REPETIDO")
            ]);

        var sut = CreateSut();

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.matrix.sku.duplicate_in_payload");
    }

    [Fact(DisplayName = "Crear producto matriz rechaza SKU que ya existe en la base de datos")]
    public async Task Handle_ExistingSkuInDb_ReturnsConflict()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _items.SkuExistsIgnoreCaseAsync(tenantId, "SKU-EXISTENTE", null, Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new CreateCatalogItemMatrixCommand(
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín",
            null,
            ModelCode: null,
            BasePrice: 2.0m,
            VariantDimensionsJson: "[{\"name\": \"Talla\", \"values\": [\"S\"]}]",
            Variants:
            [
                new CreateVariantChildDto("S", "SKU-EXISTENTE")
            ]);

        var sut = CreateSut();

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.matrix.sku.duplicate_in_db");
    }

    [Fact(DisplayName = "Crear matriz con arquetipo valida la familia y la propaga al padre y variantes")]
    public async Task Handle_WithFamily_PropagatesFamilyToParentAndVariants()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var familyId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _idGenerator.NewId().Returns(Guid.CreateVersion7());
        _items.SkuExistsIgnoreCaseAsync(tenantId, Arg.Any<string>(), null, Arg.Any<CancellationToken>())
            .Returns(false);

        var family = ProductTemplate.Create(
            familyId,
            tenantId,
            "Calcetines Deportivos",
            null,
            "[]").Value!;
        _templates.GetByIdAsync(familyId, tenantId, Arg.Any<CancellationToken>()).Returns(family);

        var command = new CreateCatalogItemMatrixCommand(
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín con familia",
            null,
            ModelCode: "CALC-FAM-01",
            BasePrice: 3.50m,
            VariantDimensionsJson: "[{\"name\": \"Talla\", \"values\": [\"S\"]}]",
            Variants:
            [
                new CreateVariantChildDto("S", "CALC-FAM-01-S")
            ],
            FamilyId: familyId,
            HierarchyPathJson: "[{\"level\":\"Modelo\",\"name\":\"Material\",\"value\":\"Algodón\"}]");

        // Actuar
        var result = await CreateSut().Handle(command, CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        await _items.Received(2).AddAsync(
            Arg.Is<CatalogItem>(i => i.FamilyId == familyId),
            Arg.Any<CancellationToken>());
        await _items.Received(2).AddAsync(
            Arg.Is<CatalogItem>(i => i.HierarchyPathJson != null && i.HierarchyPathJson.Contains("Algod")),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Crear matriz con arquetipo inexistente devuelve no encontrado")]
    public async Task Handle_UnknownFamily_ReturnsNotFound()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _templates.GetByIdAsync(Arg.Any<Guid>(), tenantId, Arg.Any<CancellationToken>())
            .Returns((ProductTemplate?)null);

        var command = new CreateCatalogItemMatrixCommand(
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín",
            null,
            ModelCode: null,
            BasePrice: 2.0m,
            VariantDimensionsJson: "[{\"name\": \"Talla\", \"values\": [\"S\"]}]",
            Variants:
            [
                new CreateVariantChildDto("S", "SKU-FAM-NO-EXISTE")
            ],
            FamilyId: Guid.CreateVersion7());

        // Actuar
        var result = await CreateSut().Handle(command, CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.matrix.family.not_found");
    }

    [Fact(DisplayName = "Crear matriz bloquea cuando se alcanza el límite de variantes del plan")]
    public async Task Handle_VariantLimitReached_ReturnsForbidden()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var tenant = Tenant.Create(
            tenantId,
            "Empresa Small",
            new ServicePlan("Small", 3, 1),
            moduleEntitlements:
            [
                ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Small)
            ]).Value!;
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);
        _items.CountVariantsAsync(tenantId, false, Arg.Any<CancellationToken>()).Returns(100);

        var command = new CreateCatalogItemMatrixCommand(
            tenantId,
            CatalogItemKind.Physical,
            "Matriz límite",
            null,
            ModelCode: null,
            BasePrice: 2.0m,
            VariantDimensionsJson: "[{\"name\": \"Talla\", \"values\": [\"S\"]}]",
            Variants:
            [
                new CreateVariantChildDto("S", "LIMITE-01-S")
            ]);

        // Actuar
        var result = await CreateSut().Handle(command, CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variants.limit_reached");
    }
}
