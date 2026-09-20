using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.DeleteVariantDimensionTemplate;
using EcuNexo.Business.Catalog.Commands.UpdateVariantDimensionTemplate;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class VariantDimensionTemplateHandlerTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IVariantDimensionTemplateRepository _templates = Substitute.For<IVariantDimensionTemplateRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly UpdateVariantDimensionTemplateValidator _validator = new();

    private UpdateVariantDimensionTemplateHandler CreateUpdateSut() =>
        new(_validator, _tenants, _templates, _unitOfWork);

    private DeleteVariantDimensionTemplateHandler CreateDeleteSut() =>
        new(_tenants, _templates, _unitOfWork);

    [Fact(DisplayName = "Actualizar escala del sistema falla por ser inmutable")]
    public async Task Update_SystemDefaultTemplate_FailsWithConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var systemTemplate = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Medias / Calcetines",
            "Talla",
            "[\"35-38\",\"39-41\",\"42-44\"]",
            isSystemDefault: true).Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(systemTemplate);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Medias Modificadas",
            "Talla",
            "[\"35-38\"]");

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.system.immutable", result.Error!.Code);
    }

    [Fact(DisplayName = "Actualizar escala personalizada propia actualiza datos y persiste")]
    public async Task Update_CustomTemplate_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var customTemplate = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Escala Especial",
            "Talla",
            "[\"S\",\"M\"]",
            isSystemDefault: false).Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(customTemplate);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Escala Especial Actualizada",
            "Talla",
            "[\"S\",\"M\",\"L\",\"XL\"]");

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Escala Especial Actualizada", customTemplate.Name);
        Assert.Contains("XL", customTemplate.PredefinedValuesJson);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Eliminar escala del sistema falla por conflicto")]
    public async Task Delete_SystemDefaultTemplate_FailsWithConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var systemTemplate = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Calzado",
            "Talla",
            "[\"36\",\"37\"]",
            isSystemDefault: true).Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(systemTemplate);

        var sut = CreateDeleteSut();
        var result = await sut.Handle(new DeleteVariantDimensionTemplateCommand(templateId, tenantId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.system.cannot_delete", result.Error!.Code);
        await _templates.DidNotReceive().DeleteAsync(Arg.Any<VariantDimensionTemplate>(), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Eliminar escala personalizada propia la remueve y persiste")]
    public async Task Delete_CustomTemplate_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var customTemplate = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Escala Temporal",
            "Talla",
            "[\"1\",\"2\"]",
            isSystemDefault: false).Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(customTemplate);

        var sut = CreateDeleteSut();
        var result = await sut.Handle(new DeleteVariantDimensionTemplateCommand(templateId, tenantId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        await _templates.Received(1).DeleteAsync(customTemplate, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
