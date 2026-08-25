using EcuNexo.Core.Identity;

namespace EcuNexo.Core.UnitTests.Identity;

/// <summary>Prioridad Identity — departamentos del tenant.</summary>
public sealed class DepartmentTests
{
    [Fact(DisplayName = "Departamento válido se crea")]
    public void Create_Valid_Succeeds()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();

        // Actuar
        var result = Department.Create(Guid.CreateVersion7(), tenantId, "Ventas", "Equipo comercial");

        // Verificar
        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        result.Value!.Name.Should().Be("Ventas");
        result.Value.TenantId.Should().Be(tenantId);
        result.Value.Description.Should().Be("Equipo comercial");
    }

    [Fact(DisplayName = "Nombre vacío se rechaza")]
    public void Create_EmptyName_Fails()
    {
        // Actuar
        var result = Department.Create(Guid.CreateVersion7(), Guid.CreateVersion7(), "  ");

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("department.name.required");
    }

    [Fact(DisplayName = "Tenant vacío se rechaza")]
    public void Create_EmptyTenant_Fails()
    {
        // Actuar
        var result = Department.Create(Guid.CreateVersion7(), Guid.Empty, "IT");

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("department.tenant_id.invalid");
    }

    [Fact(DisplayName = "Departamento Administración de sistema se crea")]
    public void CreateAdministration_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();

        var result = Department.CreateAdministration(Guid.CreateVersion7(), tenantId);

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        result.Value!.Name.Should().Be(Department.AdministrationName);
        result.Value.TenantId.Should().Be(tenantId);
    }

    [Fact(DisplayName = "Administracion sin tilde es el mismo departamento de sistema")]
    public void IsAdministrationAlias_IgnoresDiacritics()
    {
        Department.IsAdministrationAlias("Administracion").Should().BeTrue();
        Department.IsAdministrationAlias("Administración").Should().BeTrue();
        Department.IsAdministrationAlias("Ventas").Should().BeFalse();
    }

    [Fact(DisplayName = "Se puede corregir el nombre")]
    public void Rename_Valid_Succeeds()
    {
        var created = Department.Create(Guid.CreateVersion7(), Guid.CreateVersion7(), "Logistica");
        created.IsSuccess.Should().BeTrue();

        var renamed = created.Value!.Rename("Logística", "Operaciones");

        renamed.IsSuccess.Should().BeTrue(because: renamed.Error?.Message);
        created.Value.Name.Should().Be("Logística");
        created.Value.Description.Should().Be("Operaciones");
        created.Value.UpdatedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "Renombrar a vacío se rechaza")]
    public void Rename_EmptyName_Fails()
    {
        var created = Department.Create(Guid.CreateVersion7(), Guid.CreateVersion7(), "Ventas");

        var renamed = created.Value!.Rename("  ", null);

        renamed.IsFailure.Should().BeTrue();
        renamed.Error!.Code.Should().Be("department.name.required");
        created.Value.Name.Should().Be("Ventas");
    }
}
