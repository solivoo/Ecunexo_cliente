using EcuNexo.Core.Identity;

namespace EcuNexo.Core.UnitTests.Identity;

/// <summary>Prioridad Identity — usuario tenant (credencial y estado).</summary>
public sealed class UserTests
{
    [Fact(DisplayName = "Usuario válido se crea activo")]
    public void Create_Valid_Succeeds()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var email = new Email("ana@everchic.ec");

        // Actuar
        var result = User.Create(
            Guid.CreateVersion7(),
            tenantId,
            email,
            "Ana Pérez",
            department: "Ventas",
            phone: "+593999",
            jobTitle: "Vendedora");

        // Verificar
        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        result.Value!.Email.Value.Should().Be("ana@everchic.ec");
        result.Value.IsDisabled.Should().BeFalse();
        result.Value.Name.Should().Be("Ana Pérez");
    }

    [Fact(DisplayName = "Nombre vacío se rechaza")]
    public void Create_EmptyName_Fails()
    {
        // Actuar
        var result = User.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            new Email("x@ecunexo.local"),
            "  ",
            department: null);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("user.name.required");
    }

    [Fact(DisplayName = "SetPasswordHash guarda el hash")]
    public void SetPasswordHash_StoresValue()
    {
        // Preparar
        var user = User.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            new Email("u@ecunexo.local"),
            "Usuario",
            null).Value!;

        // Actuar
        var set = user.SetPasswordHash("pbkdf2$demo-hash");

        // Verificar
        set.IsSuccess.Should().BeTrue();
        user.PasswordHash.Should().Be("pbkdf2$demo-hash");
    }

    [Fact(DisplayName = "Disable marca IsDisabled")]
    public void Disable_SetsFlag()
    {
        // Preparar
        var user = User.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            new Email("u@ecunexo.local"),
            "Usuario",
            null).Value!;

        // Actuar
        var disabled = user.Disable();

        // Verificar
        disabled.IsSuccess.Should().BeTrue();
        user.IsDisabled.Should().BeTrue();
    }

    [Fact(DisplayName = "Enable revierte Disable")]
    public void Enable_ClearsDisabled()
    {
        // Preparar
        var user = User.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            new Email("u@ecunexo.local"),
            "Usuario",
            null).Value!;
        user.Disable();

        // Actuar
        var enabled = user.Enable();

        // Verificar
        enabled.IsSuccess.Should().BeTrue();
        user.IsDisabled.Should().BeFalse();
    }
}
