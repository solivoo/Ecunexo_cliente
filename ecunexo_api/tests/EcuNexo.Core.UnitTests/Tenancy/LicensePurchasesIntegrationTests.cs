using System.Security.Cryptography;
using EcuNexo.Core.Licensing;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class LicensePurchasesIntegrationTests
{
    private static readonly string[] ExpectedModules =
    [
        TenantModuleCodes.Identity,
        TenantModuleCodes.Catalog,
        TenantModuleCodes.Warehousing,
        TenantModuleCodes.Inventory,
        TenantModuleCodes.Purchases,
        TenantModuleCodes.Invoicing,
    ];

    [Fact(DisplayName = "Emisión y verificación de licencia con módulo purchases y firma digital RSA")]
    public void Issue_And_Verify_License_With_Purchases_Module()
    {
        // 1. Generar par de claves RSA para prueba
        using var rsa = RSA.Create(2048);
        var privateKeyPem = rsa.ExportPkcs8PrivateKeyPem();
        var publicKeyPem = rsa.ExportSubjectPublicKeyInfoPem();

        // 2. Preparar payload con purchases y límites configurados
        var grantId = Guid.NewGuid();
        var expiresAt = DateTimeOffset.UtcNow.AddDays(365);
        var activationCode = "ACTV-TEST-PURCHASES-01";
        var validationPepper = "test-validation-pepper-16ch";
        var validationHash = LicenseHashing.ComputeValidationHash(
            LicenseHashing.NormalizeActivationCode(activationCode),
            validationPepper);

        var entitlements = new List<ModuleEntitlement>
        {
            ModuleEntitlement.FromTierWithOverrides(
                TenantModuleCodes.Identity,
                ModuleTier.Medium,
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase) { ["max_users"] = 10 }),
            ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Big),
            ModuleEntitlement.FromTier(TenantModuleCodes.Warehousing, ModuleTier.Medium),
            ModuleEntitlement.FromTier(TenantModuleCodes.Inventory, ModuleTier.Medium),
            ModuleEntitlement.FromTier(TenantModuleCodes.Purchases, ModuleTier.Medium),
            ModuleEntitlement.FromTier(TenantModuleCodes.Invoicing, ModuleTier.Medium),
        };

        var provisioning = new LicenseArtifactProvisioning(
            "compras@empresa.ec",
            "Carlos Compras",
            "12345678",
            "Adquisiciones",
            "0997654321",
            "Jefe de Compras");

        var payload = new LicenseArtifactPayload(
            grantId,
            validationHash,
            expiresAt,
            "Empresa PyME",
            MaxTenants: 1,
            MaxUsers: 10,
            MaxWarehouses: 3,
            EnabledModuleCodes: ExpectedModules,
            ModuleEntitlements: entitlements,
            Provisioning: provisioning,
            SupersedesGrantId: null,
            OnlineValidationIntervalDays: 30);

        // 3. Firmar el artefacto de licencia (.lic)
        var signedJson = LicenseArtifactCodec.Sign(payload, privateKeyPem);
        signedJson.Should().NotBeNullOrWhiteSpace();

        // 4. Verificar firma criptográfica y decodificar
        var verifyResult = LicenseArtifactCodec.Verify(signedJson, publicKeyPem);
        verifyResult.IsSuccess.Should().BeTrue();

        var decoded = verifyResult.Value!;
        decoded.GrantId.Should().Be(grantId);
        decoded.PlanLabel.Should().Be("Empresa PyME");
        decoded.EnabledModuleCodes.Should().Contain(TenantModuleCodes.Purchases);
        decoded.EnabledModuleCodes.Should().BeEquivalentTo(ExpectedModules);

        // 5. Verificar que el entitlement de purchases resuelva los límites Medium
        var purchasesEntitlement = decoded.ModuleEntitlements?.FirstOrDefault(e => e.ModuleCode == TenantModuleCodes.Purchases);
        purchasesEntitlement.Should().NotBeNull();
        purchasesEntitlement!.Tier.Should().Be(ModuleTier.Medium);
        purchasesEntitlement.GetLimit(ModuleTierCatalog.LimitMaxMonthlyPurchases).Should().Be(250);
        purchasesEntitlement.GetLimit(ModuleTierCatalog.LimitMaxSuppliers).Should().Be(100);
        purchasesEntitlement.GetLimit(ModuleTierCatalog.LimitMaxMonthlyWithholdings).Should().Be(250);

        // 6. Verificar consistencia del grafo de dependencias
        var depErrors = ModuleDependencyGraph.Validate(decoded.EnabledModuleCodes);
        depErrors.Should().BeEmpty();
    }
}
