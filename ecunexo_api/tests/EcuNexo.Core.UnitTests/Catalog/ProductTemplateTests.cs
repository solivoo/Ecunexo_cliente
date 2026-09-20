using EcuNexo.Core.Catalog;

namespace EcuNexo.Core.UnitTests.Catalog;

public sealed class ProductTemplateTests
{
    [Fact(DisplayName = "Creación de plantilla de producto válida tiene éxito")]
    public void Create_ValidProductTemplate_Succeeds()
    {
        var id = Guid.CreateVersion7();
        var tenantId = Guid.CreateVersion7();
        var treeJson = @"[
            {
                ""id"": ""lvl-1"",
                ""name"": ""Colección"",
                ""hasColor"": false,
                ""hasImages"": false,
                ""attributes"": [""Material""]
            },
            {
                ""id"": ""lvl-2"",
                ""name"": ""Modelo / Estilo"",
                ""hasColor"": false,
                ""hasImages"": true,
                ""attributes"": []
            },
            {
                ""id"": ""lvl-3"",
                ""name"": ""Variantes Físicas"",
                ""hasColor"": true,
                ""hasImages"": true,
                ""attributes"": [""Talla""]
            }
        ]";

        var result = ProductTemplate.Create(
            id,
            tenantId,
            "Arquetipo Calcetines & Deportivo",
            "Plantilla jerárquica para prendas y calcetería deportiva de 3 niveles",
            treeJson,
            isActive: true);

        result.IsSuccess.Should().BeTrue();
        var template = result.Value!;
        template.Id.Should().Be(id);
        template.TenantId.Should().Be(tenantId);
        template.Name.Should().Be("Arquetipo Calcetines & Deportivo");
        template.Description.Should().Be("Plantilla jerárquica para prendas y calcetería deportiva de 3 niveles");
        template.HierarchyTreeJson.Should().Contain("lvl-3");
        template.IsActive.Should().BeTrue();
        template.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact(DisplayName = "Plantilla con ID o TenantId vacío es rechazada")]
    public void Create_EmptyGuids_Fails()
    {
        var validId = Guid.CreateVersion7();
        var validTenantId = Guid.CreateVersion7();

        var resId = ProductTemplate.Create(Guid.Empty, validTenantId, "Test", null, "[]");
        resId.IsFailure.Should().BeTrue();
        resId.Error!.Code.Should().Be("catalog.product_template.id.invalid");

        var resTenant = ProductTemplate.Create(validId, Guid.Empty, "Test", null, "[]");
        resTenant.IsFailure.Should().BeTrue();
        resTenant.Error!.Code.Should().Be("catalog.product_template.tenant.invalid");
    }

    [Fact(DisplayName = "Plantilla con nombre vacío o excedido es rechazada")]
    public void Create_InvalidName_Fails()
    {
        var id = Guid.CreateVersion7();
        var tenantId = Guid.CreateVersion7();

        var resEmpty = ProductTemplate.Create(id, tenantId, "   ", null, "[]");
        resEmpty.IsFailure.Should().BeTrue();
        resEmpty.Error!.Code.Should().Be("catalog.product_template.name.required");

        var longName = new string('A', 121);
        var resLong = ProductTemplate.Create(id, tenantId, longName, null, "[]");
        resLong.IsFailure.Should().BeTrue();
        resLong.Error!.Code.Should().Be("catalog.product_template.name.length");
    }

    [Fact(DisplayName = "Plantilla con JSON de árbol inválido es rechazada")]
    public void Create_InvalidHierarchyTreeJson_Fails()
    {
        var id = Guid.CreateVersion7();
        var tenantId = Guid.CreateVersion7();

        var result = ProductTemplate.Create(id, tenantId, "Plantilla", null, "not-a-valid-json");
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.product_template.tree.invalid_json");
    }

    [Fact(DisplayName = "Actualización y cambio de estado de plantilla funcionan correctamente")]
    public void Update_And_StateChanges_Succeed()
    {
        var id = Guid.CreateVersion7();
        var tenantId = Guid.CreateVersion7();
        var template = ProductTemplate.Create(id, tenantId, "Original", null, "[]").Value!;

        var updateRes = template.Update("Actualizado", "Nueva descripción", "[{\"id\":\"lvl-1\"}]", isActive: true);
        updateRes.IsSuccess.Should().BeTrue();
        template.Name.Should().Be("Actualizado");
        template.Description.Should().Be("Nueva descripción");
        template.HierarchyTreeJson.Should().Contain("lvl-1");

        template.Deactivate();
        template.IsActive.Should().BeFalse();

        template.Activate();
        template.IsActive.Should().BeTrue();
    }
}
