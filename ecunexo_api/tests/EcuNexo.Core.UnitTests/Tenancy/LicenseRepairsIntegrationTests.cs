using System.Security.Cryptography;
using EcuNexo.Core.Licensing;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class LicenseRepairsIntegrationTests
{
    private static readonly string[] ExpectedModules = [TenantModuleCodes.Identity, TenantModuleCodes.Repairs, TenantModuleCodes.Catalog];

    [Fact(DisplayName = "Emisión y verificación de licencia con módulo repairs y firma digital RSA")]
    public void Issue_And_Verify_License_With_Repairs_Module()
    {
        // 1. Generar par de claves RSA para prueba
        using var rsa = RSA.Create(2048);
        var privateKeyPem = rsa.ExportPkcs8PrivateKeyPem();
        var publicKeyPem = rsa.ExportSubjectPublicKeyInfoPem();

        // 2. Preparar payload con repairs y límites
        var grantId = Guid.NewGuid();
        var expiresAt = DateTimeOffset.UtcNow.AddDays(365);
        var moduleCodes = new[] { TenantModuleCodes.Identity, TenantModuleCodes.Repairs, TenantModuleCodes.Catalog };

        var entitlements = new List<ModuleEntitlement>
        {
            ModuleEntitlement.FromTier(TenantModuleCodes.Identity, ModuleTier.Small),
            ModuleEntitlement.FromTierWithOverrides(
                TenantModuleCodes.Repairs,
                ModuleTier.Medium,
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    [ModuleTierCatalog.LimitMaxActiveBatches] = 50,
                    [ModuleTierCatalog.LimitMaxEquipmentsPerBatch] = 500,
                }),
            ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Big),
        };

        var provisioning = new LicenseArtifactProvisioning(
            "admin@taller-demo.local",
            "Taller Demo Admin",
            "Admin123!",
            "Sistemas",
            "0991234567",
            "Jefe de Taller");

        var payload = new LicenseArtifactPayload(
            grantId,
            "demo-validation-hash-1234567890abcdef",
            expiresAt,
            "Taller",
            MaxTenants: 1,
            MaxUsers: 5,
            MaxWarehouses: 2,
            EnabledModuleCodes: moduleCodes,
            ModuleEntitlements: entitlements,
            Provisioning: provisioning);

        // 3. Firmar el artefacto de licencia
        var signedJson = LicenseArtifactCodec.Sign(payload, privateKeyPem);
        signedJson.Should().NotBeNullOrWhiteSpace();

        // 4. Verificar firma criptográfica y decodificar
        var verifyResult = LicenseArtifactCodec.Verify(signedJson, publicKeyPem);
        verifyResult.IsSuccess.Should().BeTrue();

        var decoded = verifyResult.Value!;
        decoded.GrantId.Should().Be(grantId);
        decoded.PlanLabel.Should().Be("Taller");
        decoded.EnabledModuleCodes.Should().Contain(TenantModuleCodes.Repairs);
        decoded.EnabledModuleCodes.Should().BeEquivalentTo(ExpectedModules);

        // 5. Validar límites de repairs en el artefacto decodificado
        var repairEntitlement = decoded.ModuleEntitlements?.FirstOrDefault(e => e.ModuleCode == TenantModuleCodes.Repairs);
        repairEntitlement.Should().NotBeNull();
        repairEntitlement!.Tier.Should().Be(ModuleTier.Medium);
        repairEntitlement.GetLimit(ModuleTierCatalog.LimitMaxActiveBatches).Should().Be(50);
        repairEntitlement.GetLimit(ModuleTierCatalog.LimitMaxEquipmentsPerBatch).Should().Be(500);
    }

    [Fact(DisplayName = "Licencia firmada con claves PEM de desarrollo verifica correctamente")]
    public void Verify_License_With_Dev_Pem_Keys()
    {
        var privateKeyPath = "/home/solivo/Documentos/ecunexo/Licencias/ecunexo_license_api/src/EcuNexo.Platform.Api/dev-license-private.pem";
        var publicKeyPath = "/home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/dev-license-public.pem";

        if (!File.Exists(privateKeyPath) || !File.Exists(publicKeyPath))
        {
            return;
        }

        var privatePem = File.ReadAllText(privateKeyPath);
        var publicPem = File.ReadAllText(publicKeyPath);

        var payload = new LicenseArtifactPayload(
            Guid.NewGuid(),
            "val-hash-123",
            DateTimeOffset.UtcNow.AddDays(30),
            "Taller",
            1, 5, 2,
            [TenantModuleCodes.Identity, TenantModuleCodes.Repairs, TenantModuleCodes.Catalog],
            [ModuleEntitlement.FromTier(TenantModuleCodes.Repairs, ModuleTier.Small)],
            new LicenseArtifactProvisioning("test@taller.ec", "Test", "Secret123!"));

        var signed = LicenseArtifactCodec.Sign(payload, privatePem);
        var verified = LicenseArtifactCodec.Verify(signed, publicPem);

        verified.IsSuccess.Should().BeTrue();
        verified.Value!.EnabledModuleCodes.Should().Contain("repairs");
    }
}
