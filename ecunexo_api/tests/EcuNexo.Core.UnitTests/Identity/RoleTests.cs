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
}
