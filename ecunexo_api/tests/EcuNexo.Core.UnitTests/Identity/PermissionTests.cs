using EcuNexo.Core.Identity;

namespace EcuNexo.Core.UnitTests.Identity;

/// <summary>Prioridad Identity — permisos de catálogo global (RBAC).</summary>
public sealed class PermissionTests
{
    [Fact(DisplayName = "Permiso con código válido se normaliza a minúsculas")]
    public void Create_ValidCode_NormalizesLowercase()
    {
        // Actuar
        var result = Permission.Create(
            Guid.CreateVersion7(),
            "Catalog.Item.Read",
            "Leer ítems",
            displayName: "Leer ítems",
            module: "catalog");

        // Verificar
        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        result.Value!.Code.Should().Be("catalog.item.read");
        result.Value.Module.Should().Be("catalog");
        result.Value.Status.Should().Be(PermissionStatus.Active);
    }

    [Fact(DisplayName = "Código vacío se rechaza")]
    public void Create_EmptyCode_Fails()
    {
        // Actuar
        var result = Permission.Create(Guid.CreateVersion7(), "  ", null);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("permission.code.required");
    }

    [Fact(DisplayName = "Código con caracteres inválidos se rechaza")]
    public void Create_InvalidCharacters_Fails()
    {
        // Actuar
        var result = Permission.Create(Guid.CreateVersion7(), "identity.users_create", null);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("permission.code.format");
    }

    [Fact(DisplayName = "Código con puntos consecutivos se rechaza")]
    public void Create_DoubleDots_Fails()
    {
        // Actuar
        var result = Permission.Create(Guid.CreateVersion7(), "identity..users.create", null);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("permission.code.format");
    }
}
