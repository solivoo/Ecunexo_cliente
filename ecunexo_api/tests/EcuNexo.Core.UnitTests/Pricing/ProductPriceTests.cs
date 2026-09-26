using EcuNexo.Core.Pricing;

namespace EcuNexo.Core.UnitTests.Pricing;

public sealed class ProductPriceTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "Creación de precio vigente válida")]
    public void Create_ValidPrice_Succeeds()
    {
        var result = ProductPrice.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            12.3456789m,
            Today,
            null);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Price.Should().Be(12.345679m);
        result.Value!.IsActive.Should().BeTrue();
        result.Value!.Tiers.Should().BeEmpty();
    }

    [Fact(DisplayName = "Precio negativo es rechazado")]
    public void Create_NegativePrice_Fails()
    {
        var result = ProductPrice.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            -1m,
            Today,
            null);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price.range");
    }

    [Fact(DisplayName = "Vigencia invertida es rechazada")]
    public void Create_InvalidValidity_Fails()
    {
        var result = ProductPrice.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            10m,
            Today,
            Today.AddDays(-5));

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price.validity");
    }

    [Fact(DisplayName = "Escala por cantidad válida se agrega al precio")]
    public void AddTier_ValidTier_Succeeds()
    {
        var price = CreatePrice();

        var result = price.AddTier(Guid.CreateVersion7(), 6m, 20m, 9.5m);

        result.IsSuccess.Should().BeTrue();
        price.Tiers.Should().ContainSingle();
        result.Value!.Includes(10m).Should().BeTrue();
        result.Value!.Includes(5m).Should().BeFalse();
    }

    [Fact(DisplayName = "Escala superpuesta es rechazada")]
    public void AddTier_OverlappingTier_Fails()
    {
        var price = CreatePrice();
        price.AddTier(Guid.CreateVersion7(), 6m, 20m, 9.5m).IsSuccess.Should().BeTrue();

        var result = price.AddTier(Guid.CreateVersion7(), 15m, null, 8.5m);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.tier.overlap");
        price.Tiers.Should().ContainSingle();
    }

    [Fact(DisplayName = "Una escala desactivada no bloquea una nueva escala superpuesta")]
    public void AddTier_AfterDeactivate_AllowsOverlap()
    {
        var price = CreatePrice();
        var tier = price.AddTier(Guid.CreateVersion7(), 6m, 20m, 9.5m).Value!;

        price.DeactivateTier(tier.Id).IsSuccess.Should().BeTrue();
        var result = price.AddTier(Guid.CreateVersion7(), 6m, null, 8.5m);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact(DisplayName = "IsValidOn respeta estado y vigencia del precio")]
    public void IsValidOn_RespectsStateAndRange()
    {
        var price = ProductPrice.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            10m,
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 6, 30)).Value!;

        price.IsValidOn(new DateOnly(2026, 1, 1)).Should().BeTrue();
        price.IsValidOn(new DateOnly(2026, 7, 1)).Should().BeFalse();

        price.SetActive(false).IsSuccess.Should().BeTrue();
        price.IsValidOn(new DateOnly(2026, 3, 1)).Should().BeFalse();
    }

    private static ProductPrice CreatePrice() =>
        ProductPrice.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            10m,
            Today,
            null).Value!;
}
