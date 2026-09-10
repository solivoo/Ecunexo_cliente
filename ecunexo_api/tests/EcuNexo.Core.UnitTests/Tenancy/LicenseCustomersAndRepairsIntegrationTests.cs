using System.Security.Cryptography;
using EcuNexo.Core.Licensing;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class LicenseCustomersAndRepairsIntegrationTests
{
    private static readonly string[] ExpectedModules =
    [
        TenantModuleCodes.Identity,
        TenantModuleCodes.Customers,
        TenantModuleCodes.Repairs,
        TenantModuleCodes.Catalog,
        TenantModuleCodes.Inventory,
        TenantModuleCodes.Warehousing,
        TenantModuleCodes.Invoicing,
    ];

    [Fact(DisplayName = "Emisión y verificación de licencia con módulos customers y repairs más firma digital RSA")]
    public void Issue_And_Verify_License_With_Customers_And_Repairs_Modules()
    {
        // 1. Generar par de claves RSA para prueba
        using var rsa = RSA.Create(2048);
        var privateKeyPem = rsa.ExportPkcs8PrivateKeyPem();
        var publicKeyPem = rsa.ExportSubjectPublicKeyInfoPem();

        // 2. Preparar payload con customers, repairs y límites
        var grantId = Guid.NewGuid();
        var supersedesGrantId = Guid.NewGuid();
        var expiresAt = DateTimeOffset.UtcNow.AddDays(365);
        var activationCode = "ACTV-TEST-CUST-REPR";
        var validationPepper = "test-validation-pepper-16ch";
        var validationHash = LicenseHashing.ComputeValidationHash(
            LicenseHashing.NormalizeActivationCode(activationCode),
            validationPepper);

        var entitlements = new List<ModuleEntitlement>
        {
            ModuleEntitlement.FromTierWithOverrides(
                TenantModuleCodes.Identity,
                ModuleTier.Medium,
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase) { ["max_users"] = 25 }),
            ModuleEntitlement.FromTierWithOverrides(
                TenantModuleCodes.Customers,
                ModuleTier.Medium,
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase) { [ModuleTierCatalog.LimitMaxCustomers] = 1_000 }),
            ModuleEntitlement.FromTierWithOverrides(
                TenantModuleCodes.Repairs,
                ModuleTier.Medium,
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    [ModuleTierCatalog.LimitMaxActiveBatches] = 50,
                    [ModuleTierCatalog.LimitMaxEquipmentsPerBatch] = 500,
                }),
            ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Big),
            ModuleEntitlement.FromTier(TenantModuleCodes.Inventory, ModuleTier.Medium),
            ModuleEntitlement.FromTier(TenantModuleCodes.Warehousing, ModuleTier.Medium),
            ModuleEntitlement.FromTier(TenantModuleCodes.Invoicing, ModuleTier.Medium),
        };

        var provisioning = new LicenseArtifactProvisioning(
            "admin@everchic.ec",
            "Gina",
            "12345678",
            "Gerencia",
            "0991234567",
            "Titular");

        var payload = new LicenseArtifactPayload(
            grantId,
            validationHash,
            expiresAt,
            "Enterprise Plus",
            MaxTenants: 1,
            MaxUsers: 25,
            MaxWarehouses: 5,
            EnabledModuleCodes: ExpectedModules,
            ModuleEntitlements: entitlements,
            Provisioning: provisioning,
            SupersedesGrantId: supersedesGrantId,
            OnlineValidationIntervalDays: 30);

        // 3. Firmar el artefacto de licencia
        var signedJson = LicenseArtifactCodec.Sign(payload, privateKeyPem);
        signedJson.Should().NotBeNullOrWhiteSpace();

        // 4. Verificar firma criptográfica y decodificar
        var verifyResult = LicenseArtifactCodec.Verify(signedJson, publicKeyPem);
        verifyResult.IsSuccess.Should().BeTrue();

        var decoded = verifyResult.Value!;
        decoded.GrantId.Should().Be(grantId);
        decoded.SupersedesGrantId.Should().Be(supersedesGrantId);
        decoded.PlanLabel.Should().Be("Enterprise Plus");
        decoded.EnabledModuleCodes.Should().Contain(TenantModuleCodes.Customers);
        decoded.EnabledModuleCodes.Should().Contain(TenantModuleCodes.Repairs);
        decoded.EnabledModuleCodes.Should().BeEquivalentTo(ExpectedModules);

        // 5. Verificar consistencia de dependencias
        var depErrors = ModuleDependencyGraph.Validate(decoded.EnabledModuleCodes);
        depErrors.Should().BeEmpty();
    }
}
