using EcuNexo.Core.Pricing;

namespace EcuNexo.Core.UnitTests.Pricing;

public sealed class VolumeDiscountSchemeTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact(DisplayName = "Crea un esquema de volumen válido con tipo porcentual")]
    public void Create_ValidPercentageScheme_Succeeds()
    {
        var schemeId = Guid.NewGuid();
        var result = VolumeDiscountScheme.Create(
            schemeId,
            TenantId,
            "Escala Calcetines",
            "Escala mayorista de calcetines",
            VolumeDiscountSchemeType.Percentage);

        result.IsSuccess.Should().BeTrue();
        var scheme = result.Value!;
        scheme.Id.Should().Be(schemeId);
        scheme.TenantId.Should().Be(TenantId);
        scheme.Name.Should().Be("Escala Calcetines");
        scheme.Description.Should().Be("Escala mayorista de calcetines");
        scheme.Type.Should().Be(VolumeDiscountSchemeType.Percentage);
        scheme.IsActive.Should().BeTrue();
        scheme.Tiers.Should().BeEmpty();
    }

    [Fact(DisplayName = "Falla si el nombre es vacío")]
    public void Create_EmptyName_Fails()
    {
        var result = VolumeDiscountScheme.Create(
            Guid.NewGuid(),
            TenantId,
            "   ",
            null,
            VolumeDiscountSchemeType.Percentage);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.volume_scheme.name.required");
    }

    [Fact(DisplayName = "Agrega escalones válidos al esquema")]
    public void AddTier_ValidTiers_AddsToCollection()
    {
        var scheme = CreateDefaultScheme();

        var tier1 = scheme.AddTier(Guid.NewGuid(), 6m, 11m, 15m);
        var tier2 = scheme.AddTier(Guid.NewGuid(), 12m, null, 25m);

        tier1.IsSuccess.Should().BeTrue();
        tier2.IsSuccess.Should().BeTrue();
        scheme.Tiers.Should().HaveCount(2);

        scheme.Tiers[0].QuantityFrom.Should().Be(6m);
        scheme.Tiers[0].QuantityTo.Should().Be(11m);
        scheme.Tiers[0].Value.Should().Be(15m);

        scheme.Tiers[1].QuantityFrom.Should().Be(12m);
        scheme.Tiers[1].QuantityTo.Should().BeNull();
        scheme.Tiers[1].Value.Should().Be(25m);
    }

    [Fact(DisplayName = "Rechaza escalones superpuestos")]
    public void AddTier_OverlappingTiers_Fails()
    {
        var scheme = CreateDefaultScheme();
        scheme.AddTier(Guid.NewGuid(), 6m, 12m, 15m).IsSuccess.Should().BeTrue();

        var overlapResult = scheme.AddTier(Guid.NewGuid(), 10m, 20m, 20m);

        overlapResult.IsFailure.Should().BeTrue();
        overlapResult.Error!.Code.Should().Be("catalog.pricing.volume_scheme.tier.overlap");
    }

    [Fact(DisplayName = "Rechaza porcentajes mayores a 100")]
    public void AddTier_PercentageGreaterThan100_Fails()
    {
        var scheme = CreateDefaultScheme(VolumeDiscountSchemeType.Percentage);

        var result = scheme.AddTier(Guid.NewGuid(), 6m, null, 105m);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.volume_tier.percentage.range");
    }

    [Fact(DisplayName = "Rechaza cantidad inicial menor o igual a cero")]
    public void AddTier_QuantityZeroOrNegative_Fails()
    {
        var scheme = CreateDefaultScheme();

        var result = scheme.AddTier(Guid.NewGuid(), 0m, 10m, 10m);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.volume_tier.range");
    }

    [Fact(DisplayName = "Rechaza cantidad final menor que la inicial")]
    public void AddTier_QuantityToLessThanFrom_Fails()
    {
        var scheme = CreateDefaultScheme();

        var result = scheme.AddTier(Guid.NewGuid(), 10m, 5m, 10m);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.volume_tier.range");
    }

    [Fact(DisplayName = "Desactivar un escalón permite volver a ocupar el rango")]
    public void DeactivateTier_AllowsAddingSameRange()
    {
        var scheme = CreateDefaultScheme();
        var tierId = Guid.NewGuid();
        scheme.AddTier(tierId, 6m, 12m, 15m).IsSuccess.Should().BeTrue();

        scheme.DeactivateTier(tierId).IsSuccess.Should().BeTrue();

        var newTierResult = scheme.AddTier(Guid.NewGuid(), 6m, 12m, 20m);
        newTierResult.IsSuccess.Should().BeTrue();
    }

    private static VolumeDiscountScheme CreateDefaultScheme(
        VolumeDiscountSchemeType type = VolumeDiscountSchemeType.Percentage) =>
        VolumeDiscountScheme.Create(
            Guid.NewGuid(),
            TenantId,
            "Escala Calcetines",
            "Descripción",
            type).Value!;
}
