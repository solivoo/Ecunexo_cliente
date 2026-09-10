using EcuNexo.Core.Catalog;
using EcuNexo.Core.UnitTests.Support;

namespace EcuNexo.Core.UnitTests.Catalog;

/// <summary>
/// Prioridad 1 — Catálogo es la base: sin ítem físico/válido no hay stock ni factura limpia.
/// </summary>
public sealed class CatalogItemTests
{
    [Fact(DisplayName = "Ítem físico sin SKU se rechaza (ADR-010: 1 físico = 1 SKU)")]
    public void Create_PhysicalWithoutSku_ReturnsValidationError()
    {
        // Preparar / Actuar
        var result = CatalogItem.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Producto sin código",
            description: null,
            sku: null,
            basePrice: 10m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.sku.required");
    }

    [Fact(DisplayName = "Ítem de servicio puede crearse sin SKU (plan services-starter)")]
    public void Create_ServiceWithoutSku_Succeeds()
    {
        // Preparar / Actuar
        var item = CatalogTestFactory.Service();

        // Verificar
        item.Kind.Should().Be(CatalogItemKind.Service);
        item.Sku.Should().BeNull();
    }

    [Fact(DisplayName = "Ítem físico con SKU válido queda activo")]
    public void Create_PhysicalWithSku_Succeeds()
    {
        // Preparar / Actuar
        var item = CatalogTestFactory.Physical(sku: "SKU-001");

        // Verificar
        item.Kind.Should().Be(CatalogItemKind.Physical);
        item.Sku.Should().Be("SKU-001");
        item.Status.Should().Be(CatalogItemStatus.Active);
    }

    [Fact(DisplayName = "Servicio puede pasar a físico si se informa SKU")]
    public void ChangeKind_ServiceToPhysicalWithSku_Succeeds()
    {
        var item = CatalogTestFactory.Service(name: "Mouse");

        var result = item.ChangeKind(CatalogItemKind.Physical, "MOU01", updatedBy: null);

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        item.Kind.Should().Be(CatalogItemKind.Physical);
        item.Sku.Should().Be("MOU01");
    }

    [Fact(DisplayName = "Servicio a físico sin SKU se rechaza")]
    public void ChangeKind_ServiceToPhysicalWithoutSku_ReturnsValidationError()
    {
        var item = CatalogTestFactory.Service();

        var result = item.ChangeKind(CatalogItemKind.Physical, sku: null, updatedBy: null);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.sku.required");
        item.Kind.Should().Be(CatalogItemKind.Service);
    }

    [Fact(DisplayName = "Físico puede pasar a servicio")]
    public void ChangeKind_PhysicalToService_Succeeds()
    {
        var item = CatalogTestFactory.Physical();

        var result = item.ChangeKind(CatalogItemKind.Service, sku: null, updatedBy: null);

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        item.Kind.Should().Be(CatalogItemKind.Service);
        item.Sku.Should().BeNull();
    }

    [Fact(DisplayName = "NormalizeSchema rechaza claves duplicadas")]
    public void NormalizeSchema_DuplicateKeys_ReturnsValidationError()
    {
        var json = """[{"key":"color","label":"Color"},{"key":"color","label":"Color 2"}]""";
        var result = CatalogAttributeSchema.NormalizeSchema(json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.schema.duplicate_key");
    }

    [Fact(DisplayName = "NormalizeSchema rechaza etiquetas duplicadas")]
    public void NormalizeSchema_DuplicateLabels_ReturnsValidationError()
    {
        var json = """[{"key":"capacidad_1","label":"Capacidad"},{"key":"capacidad_2","label":"Capacidad"}]""";
        var result = CatalogAttributeSchema.NormalizeSchema(json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.schema.duplicate_label");
    }

    [Fact(DisplayName = "NormalizeSchema rechaza campos que coinciden con campos nativos del ítem")]
    public void NormalizeSchema_ReservedKeyOrLabel_ReturnsValidationError()
    {
        var json = """[{"key":"nombre","label":"Nombre"}]""";
        var result = CatalogAttributeSchema.NormalizeSchema(json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.schema.reserved_key");
    }
}
