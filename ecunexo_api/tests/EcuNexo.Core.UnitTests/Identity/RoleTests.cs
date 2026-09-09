using EcuNexo.Core.Identity;

namespace EcuNexo.Core.UnitTests.Identity;

/// <summary>Prioridad Identity — roles RBAC por tenant.</summary>
public sealed class RoleTests
{
    [Fact(DisplayName = "Rol válido se crea")]
    public void Create_Valid_Succeeds()
    {
        // Actuar
        var result = Role.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Administrador",
            "Acceso amplio",
            isSystem: false);

        // Verificar
        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        result.Value!.Name.Should().Be("Administrador");
        result.Value.IsSystem.Should().BeFalse();
    }

    [Fact(DisplayName = "Nombre vacío se rechaza")]
    public void Create_EmptyName_Fails()
    {
        // Actuar
        var result = Role.Create(Guid.CreateVersion7(), Guid.CreateVersion7(), " ");

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("role.name.required");
    }

    [Fact(DisplayName = "Rol de sistema marca IsSystem")]
    public void Create_SystemRole_SetsFlag()
    {
        // Actuar
        var result = Role.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Owner",
            isSystem: true);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        result.Value!.IsSystem.Should().BeTrue();
    }

    [Fact(DisplayName = "Se puede actualizar el nombre y descripción del rol")]
    public void Update_Valid_Succeeds()
    {
        var role = Role.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Vendedor",
            "Ventas básicas").Value!;

        var result = role.Update("Ejecutivo de Ventas", "Ventas B2B y corporativas");

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        role.Name.Should().Be("Ejecutivo de Ventas");
        role.Description.Should().Be("Ventas B2B y corporativas");
        role.UpdatedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "Actualizar rol a nombre vacío se rechaza")]
    public void Update_EmptyName_Fails()
    {
        var role = Role.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Vendedor").Value!;

        var result = role.Update("   ", null);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("role.name.required");
        role.Name.Should().Be("Vendedor");
    }

    [Fact(DisplayName = "Rol de sistema no se puede eliminar")]
    public void SoftDelete_SystemRole_Fails()
    {
        var role = Role.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Administrador",
            isSystem: true).Value!;

        var result = role.SoftDelete(DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("role.system.immutable");
        role.DeletedAt.Should().BeNull();
    }

    [Fact(DisplayName = "Rol personalizado se puede dar de baja lógica")]
    public void SoftDelete_CustomRole_Succeeds()
    {
        var role = Role.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Operador",
            isSystem: false).Value!;

        var now = DateTimeOffset.UtcNow;
        var userId = Guid.CreateVersion7();
        var result = role.SoftDelete(now, userId);

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        role.DeletedAt.Should().Be(now);
        role.DeletedBy.Should().Be(userId);
    }
}
