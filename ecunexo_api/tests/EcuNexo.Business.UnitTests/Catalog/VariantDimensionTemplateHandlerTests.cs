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
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly UpdateVariantDimensionTemplateValidator _validator = new();

    private UpdateVariantDimensionTemplateHandler CreateUpdateSut() =>
        new(_validator, _tenants, _templates, _items, _unitOfWork);

    private DeleteVariantDimensionTemplateHandler CreateDeleteSut() =>
        new(_tenants, _templates, _items, _unitOfWork);

    [Fact(DisplayName = "Renombrar plantilla en uso propaga el cambio a los ítems asociados")]
    public async Task Update_WhenInUseAndRenamed_PropagatesToItems()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var systemTemplate = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Medias / Calcetines",
            "Talla",
            "[\"35-38\",\"39-41\",\"42-44\"]").Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(systemTemplate);

        _items.RenameAttributeKeyAsync(
                tenantId,
                "Medias / Calcetines",
                "Medias Modificadas",
                Arg.Any<Guid?>(),
                Arg.Any<CancellationToken>())
            .Returns([
                Guid.CreateVersion7(),
                Guid.CreateVersion7(),
                Guid.CreateVersion7(),
                Guid.CreateVersion7(),
            ]);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Medias Modificadas",
            "Talla",
            "[\"35-38\",\"39-41\",\"42-44\"]");

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Medias Modificadas", systemTemplate.Name);
        Assert.Equal(4, result.Value!.RenamedItems);
        await _items.Received(1).RenameAttributeKeyAsync(
            tenantId,
            "Medias / Calcetines",
            "Medias Modificadas",
            Arg.Any<Guid?>(),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Renombrar a un nombre ya existente falla con conflicto")]
    public async Task Update_WhenTargetNameExists_FailsWithConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var template = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Escala Propia",
            "Talla",
            "[\"S\",\"M\"]").Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(template);

        _templates.ExistsByNameAsync(tenantId, "Escala Existente", templateId, Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Escala Existente",
            "Talla",
            "[\"S\",\"M\"]");

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.name.duplicate", result.Error!.Code);
        await _items.DidNotReceive().RenameAttributeKeyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<Guid?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Renombrar una opción en uso propaga el valor a los ítems asociados")]
    public async Task Update_WithValueRenames_PropagatesValues()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var template = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Escala Especial",
            "Talla",
            "[\"S\",\"M\",\"L\"]").Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(template);

        _items.RenameAttributeValueAsync(
                tenantId,
                "Escala Especial",
                "M",
                "Mediano",
                false,
                true,
                Arg.Any<Guid?>(),
                Arg.Any<CancellationToken>())
            .Returns([Guid.CreateVersion7(), Guid.CreateVersion7()]);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Escala Especial",
            "Talla",
            "[\"S\",\"Mediano\",\"L\"]",
            ValueRenames: [new VariantValueRename("M", "Mediano")]);

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.RenamedItems);
        await _items.Received(1).RenameAttributeValueAsync(
            tenantId,
            "Escala Especial",
            "M",
            "Mediano",
            false,
            true,
            Arg.Any<Guid?>(),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Renombrar una opción inexistente falla con validación")]
    public async Task Update_WithUnknownValueRename_FailsValidation()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var template = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Escala Especial",
            "Talla",
            "[\"S\",\"M\"]").Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(template);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Escala Especial",
            "Talla",
            "[\"S\",\"M\",\"Grande\"]",
            ValueRenames: [new VariantValueRename("XL", "Grande")]);

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.value_rename.invalid", result.Error!.Code);
        await _items.DidNotReceive().RenameAttributeValueAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<bool>(),
            Arg.Any<bool>(),
            Arg.Any<Guid?>(),
            Arg.Any<CancellationToken>());
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
            "[\"S\",\"M\"]").Value!;

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

    [Fact(DisplayName = "Eliminar plantilla que está en uso en catálogo falla por conflicto")]
    public async Task Delete_WhenInUse_FailsWithConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var systemTemplate = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Calzado",
            "Talla",
            "[\"36\",\"37\"]").Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(systemTemplate);

        _items.IsAttributeTemplateInUseAsync(tenantId, "Calzado", Arg.Any<CancellationToken>())
            .Returns(true);

        var sut = CreateDeleteSut();
        var result = await sut.Handle(new DeleteVariantDimensionTemplateCommand(templateId, tenantId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.in_use", result.Error!.Code);
        await _templates.DidNotReceive().DeleteAsync(Arg.Any<VariantDimensionTemplate>(), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Eliminar escala sin registros asociados la remueve y persiste")]
    public async Task Delete_WhenNotInUse_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var customTemplate = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Escala Temporal",
            "Talla",
            "[\"1\",\"2\"]").Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(customTemplate);

        _items.IsAttributeTemplateInUseAsync(tenantId, "Escala Temporal", Arg.Any<CancellationToken>())
            .Returns(false);

        var sut = CreateDeleteSut();
        var result = await sut.Handle(new DeleteVariantDimensionTemplateCommand(templateId, tenantId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        await _templates.Received(1).DeleteAsync(customTemplate, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Cambiar el tipo de un atributo en uso falla con conflicto")]
    public async Task Update_WhenInUseAndTypeChanged_FailsWithConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var template = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Colección",
            "custom",
            "[\"Halloween\"]",
            dataType: VariantDimensionTemplate.DataTypeText,
            isVariantAxis: false).Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(template);

        _items.IsAttributeTemplateInUseAsync(tenantId, "Colección", Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Colección",
            "custom",
            "[\"Halloween\"]",
            DataType: VariantDimensionTemplate.DataTypeMultiSelect,
            IsVariantAxis: false);

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("catalog.variant_template.type.in_use", result.Error!.Code);
        await _items.DidNotReceive().RenameAttributeKeyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<Guid?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Cambiar el tipo de un atributo sin uso se permite")]
    public async Task Update_WhenNotInUseAndTypeChanged_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var template = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Colección",
            "custom",
            "[\"Halloween\"]",
            dataType: VariantDimensionTemplate.DataTypeText,
            isVariantAxis: false).Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(template);

        _items.IsAttributeTemplateInUseAsync(tenantId, "Colección", Arg.Any<CancellationToken>())
            .Returns(false);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Colección",
            "custom",
            "[\"Halloween\"]",
            DataType: VariantDimensionTemplate.DataTypeMultiSelect,
            IsVariantAxis: false);

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(VariantDimensionTemplate.DataTypeMultiSelect, template.DataType);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Cambiar solo opciones de un atributo en uso no se bloquea")]
    public async Task Update_WhenInUseAndOnlyValuesChanged_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var templateId = Guid.CreateVersion7();
        _tenants.ExistsByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);

        var template = VariantDimensionTemplate.Create(
            templateId,
            tenantId,
            "Escala Especial",
            "Talla",
            "[\"S\",\"M\"]").Value!;

        _templates.GetByIdAsync(templateId, tenantId, Arg.Any<CancellationToken>())
            .Returns(template);

        _items.IsAttributeTemplateInUseAsync(tenantId, "Escala Especial", Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            "Escala Especial",
            "Talla",
            "[\"S\",\"M\",\"L\"]");

        var sut = CreateUpdateSut();
        var result = await sut.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Contains("L", template.PredefinedValuesJson);
    }
}
