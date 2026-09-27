using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.AdoptVariantDimensionTemplate;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class AdoptVariantDimensionTemplateHandlerTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IVariantDimensionTemplateRepository _templates = Substitute.For<IVariantDimensionTemplateRepository>();
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly AdoptVariantDimensionTemplateValidator _validator = new();

    private AdoptVariantDimensionTemplateHandler CreateSut() =>
        new(_validator, _tenants, _templates, _items, _unitOfWork);

    private VariantDimensionTemplate SeedTemplate(Guid tenantId, Guid templateId, string name)
    {
        var template = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            name,
            "custom",
            "[\"Halloween\"]",
            dataType: VariantDimensionTemplate.DataTypeMultiSelect,
            isVariantAxis: false).Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(template);
        return template;
    }

    [Fact(DisplayName = "Reasignar productos de otro atributo renombra la clave y persiste")]
    public async Task Adopt_WhenSourceInUse_ReassignsItems()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        SeedTemplate(tenantId, templateId, "Colección Nueva");

        _items.IsAttributeTemplateInUseAsync(tenantId, "Colección", Arg.Any<CancellationToken>())
            .Returns(true);
        _items.RenameAttributeKeyAsync(
                tenantId,
                "Colección",
                "Colección Nueva",
                Arg.Any<Guid?>(),
                Arg.Any<CancellationToken>())
            .Returns([Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7()]);

        var sut = CreateSut();
        var result = await sut.Handle(
            new AdoptVariantDimensionTemplateCommand(templateId, tenantId, "Colección"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.ReassignedItems);
        await _items.Received(1).RenameAttributeKeyAsync(
            tenantId,
            "Colección",
            "Colección Nueva",
            Arg.Any<Guid?>(),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Reasignar desde un atributo sin productos falla")]
    public async Task Adopt_WhenSourceNotInUse_FailsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        SeedTemplate(tenantId, templateId, "Colección Nueva");

        _items.IsAttributeTemplateInUseAsync(tenantId, "Colección", Arg.Any<CancellationToken>())
            .Returns(false);

        var sut = CreateSut();
        var result = await sut.Handle(
            new AdoptVariantDimensionTemplateCommand(templateId, tenantId, "Colección"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.adopt.source_not_in_use", result.Error!.Code);
        await _items.DidNotReceive().RenameAttributeKeyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<Guid?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Reasignar un atributo a sí mismo falla con validación")]
    public async Task Adopt_WhenSourceEqualsTarget_FailsValidation()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        SeedTemplate(tenantId, templateId, "Colección");

        var sut = CreateSut();
        var result = await sut.Handle(
            new AdoptVariantDimensionTemplateCommand(templateId, tenantId, "colección"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.adopt.same", result.Error!.Code);
    }

    [Fact(DisplayName = "Reasignar con plantilla inexistente falla con not found")]
    public async Task Adopt_WhenTemplateMissing_FailsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns((VariantDimensionTemplate?)null);

        var sut = CreateSut();
        var result = await sut.Handle(
            new AdoptVariantDimensionTemplateCommand(templateId, tenantId, "Colección"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.not_found", result.Error!.Code);
    }
}
