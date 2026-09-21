using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.CreateProductTemplate;
using EcuNexo.Business.Catalog.Commands.DeleteProductTemplate;
using EcuNexo.Business.Catalog.Commands.UpdateProductTemplate;
using EcuNexo.Business.Catalog.Queries.GetProductTemplateById;
using EcuNexo.Business.Catalog.Queries.ListProductTemplates;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class ProductTemplateHandlerTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IProductTemplateRepository _templates = Substitute.For<IProductTemplateRepository>();
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly CreateProductTemplateValidator _createValidator = new();
    private readonly UpdateProductTemplateValidator _updateValidator = new();

    private CreateProductTemplateHandler CreateCreateSut() =>
        new(_createValidator, _idGenerator, _tenants, _templates, _unitOfWork);

    private UpdateProductTemplateHandler CreateUpdateSut() =>
        new(_updateValidator, _tenants, _templates, _unitOfWork);

    private DeleteProductTemplateHandler CreateDeleteSut() =>
        new(_tenants, _templates, _items, _unitOfWork);

    [Fact(DisplayName = "Crear plantilla con nombre duplicado falla con conflicto")]
    public async Task Create_DuplicateName_FailsWithConflict()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _templates.ExistsByNameAsync(tenantId, "Calcetines", null, Arg.Any<CancellationToken>()).Returns(true);

        var command = new CreateProductTemplateCommand(tenantId, "Calcetines", "Desc", "[]");
        var sut = CreateCreateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.product_template.name.duplicate", result.Error!.Code);
    }

    [Fact(DisplayName = "Crear plantilla válida persiste en repositorio")]
    public async Task Create_Valid_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var generatedId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _templates.ExistsByNameAsync(tenantId, "Arquetipo Deportivo", null, Arg.Any<CancellationToken>()).Returns(false);
        _idGenerator.NewId().Returns(generatedId);

        var command = new CreateProductTemplateCommand(tenantId, "Arquetipo Deportivo", "Deportivo 3 niveles", "[{\"id\":\"lvl-1\"}]");
        var sut = CreateCreateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(generatedId, result.Value!.Id);
        await _templates.Received(1).AddAsync(Arg.Is<ProductTemplate>(t => t.Id == generatedId && t.Name == "Arquetipo Deportivo"), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Actualizar plantilla inexistente retorna NotFound")]
    public async Task Update_NotFound_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>()).Returns((ProductTemplate?)null);

        var command = new UpdateProductTemplateCommand(templateId, tenantId, "Modificado", null, "[]", true);
        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.product_template.not_found", result.Error!.Code);
    }

    [Fact(DisplayName = "Actualizar plantilla con datos válidos actualiza y persiste")]
    public async Task Update_Valid_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        var template = ProductTemplate.Create(templateId, tenantId, "Original", null, "[]").Value!;

        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>()).Returns(template);
        _templates.ExistsByNameAsync(tenantId, "Nuevo Nombre", templateId, Arg.Any<CancellationToken>()).Returns(false);

        var command = new UpdateProductTemplateCommand(templateId, tenantId, "Nuevo Nombre", "Nueva desc", "[{\"id\":\"lvl-1\"}]", true);
        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Nuevo Nombre", template.Name);
        Assert.Equal("Nueva desc", template.Description);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Eliminar plantilla válida llama a DeleteAsync")]
    public async Task Delete_Valid_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        var template = ProductTemplate.Create(templateId, tenantId, "Por borrar", null, "[]").Value!;

        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>()).Returns(template);

        var command = new DeleteProductTemplateCommand(templateId, tenantId);
        var sut = CreateDeleteSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        await _templates.Received(1).DeleteAsync(template, Arg.Any<CancellationToken>());
        await _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Eliminar plantilla en uso por productos falla con conflicto")]
    public async Task Delete_TemplateInUse_FailsWithConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        var template = ProductTemplate.Create(templateId, tenantId, "En uso", null, "[]").Value!;

        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>()).Returns(template);
        _items.CountItemsByFamilyAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, int> { [templateId] = 3 });

        var command = new DeleteProductTemplateCommand(templateId, tenantId);
        var result = await CreateDeleteSut().Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.product_template.delete.in_use", result.Error!.Code);
        await _templates.DidNotReceive().DeleteAsync(Arg.Any<ProductTemplate>(), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "List y GetById queries retornan datos esperados")]
    public async Task Queries_ReturnExpectedData()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        var template = ProductTemplate.Create(templateId, tenantId, "Plantilla Colección", "Desc", "[]").Value!;

        _templates.ListByTenantAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new List<ProductTemplate> { template });
        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(template);

        var listSut = new ListProductTemplatesHandler(_templates, _items);
        var listResult = await listSut.Handle(new ListProductTemplatesQuery(tenantId), CancellationToken.None);

        Assert.True(listResult.IsSuccess);
        Assert.Single(listResult.Value!);
        Assert.Equal("Plantilla Colección", listResult.Value![0].Name);

        var getSut = new GetProductTemplateByIdHandler(_templates);
        var getResult = await getSut.Handle(new GetProductTemplateByIdQuery(templateId, tenantId), CancellationToken.None);

        Assert.True(getResult.IsSuccess);
        Assert.Equal("Plantilla Colección", getResult.Value!.Name);
    }

    [Fact(DisplayName = "Crear plantilla bloquea cuando se alcanza el límite del plan")]
    public async Task Create_TemplateLimitReached_FailsWithForbidden()
    {
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
        _templates.CountByTenantAsync(tenantId, Arg.Any<CancellationToken>()).Returns(10);

        var command = new CreateProductTemplateCommand(tenantId, "Plantilla extra", "Desc", "[]");

        var result = await CreateCreateSut().Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.product_templates.limit_reached", result.Error!.Code);
    }
}
