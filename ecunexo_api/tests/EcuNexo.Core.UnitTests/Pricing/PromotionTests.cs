using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Core.UnitTests.Pricing;

public sealed class PromotionTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 26, 12, 0, 0, TimeSpan.Zero);

    [Fact(DisplayName = "Creación de promoción porcentual válida")]
    public void Create_ValidPercentage_Succeeds()
    {
        var result = CreatePercentage(10m);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Code.Should().Be("SEPTIEMBRE");
        result.Value!.Type.Should().Be(PromotionType.Percentage);
        result.Value!.IsActive.Should().BeTrue();
    }

    [Fact(DisplayName = "Porcentaje mayor a 100 es rechazado")]
    public void Create_PercentageAboveHundred_Fails()
    {
        var result = CreatePercentage(120m);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.promotion.value.range");
    }

    [Fact(DisplayName = "Valor negativo es rechazado")]
    public void Create_NegativeFixedAmount_Fails()
    {
        var result = Promotion.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "DESC",
            "Descuento fijo",
            null,
            PromotionType.FixedAmount,
            -1m,
            Now,
            null,
            priority: 0,
            isStackable: false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.promotion.value.range");
    }

    [Fact(DisplayName = "Fecha final anterior a la inicial es rechazada")]
    public void Create_InvalidSchedule_Fails()
    {
        var result = Promotion.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "PROMO",
            "Promo",
            null,
            PromotionType.Percentage,
            5m,
            Now,
            Now.AddDays(-1),
            priority: 0,
            isStackable: false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.promotion.schedule");
    }

    [Fact(DisplayName = "No se duplican alcances en la misma promoción")]
    public void AddTarget_Duplicate_Fails()
    {
        var promotion = CreatePercentage(10m).Value!;
        var productId = Guid.CreateVersion7().ToString();

        promotion.AddTarget(Guid.CreateVersion7(), PromotionTargetType.Product, productId).IsSuccess.Should().BeTrue();
        var result = promotion.AddTarget(Guid.CreateVersion7(), PromotionTargetType.Product, productId);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.promotion.target.duplicate");
        promotion.Targets.Should().ContainSingle();
    }

    [Fact(DisplayName = "IsApplicableOn respeta ventana de vigencia y estado")]
    public void IsApplicableOn_RespectsWindowAndState()
    {
        var promotion = Promotion.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "SEPTIEMBRE",
            "Promo septiembre",
            null,
            PromotionType.Percentage,
            10m,
            Now,
            Now.AddDays(10),
            priority: 0,
            isStackable: false).Value!;

        promotion.IsApplicableOn(Now.AddDays(-1)).Should().BeFalse();
        promotion.IsApplicableOn(Now.AddDays(5)).Should().BeTrue();
        promotion.IsApplicableOn(Now.AddDays(11)).Should().BeFalse();

        promotion.SetActive(false).IsSuccess.Should().BeTrue();
        promotion.IsApplicableOn(Now.AddDays(5)).Should().BeFalse();
    }

    [Fact(DisplayName = "Una promoción sin fecha final aplica indefinidamente")]
    public void IsApplicableOn_WithoutEnd_StaysActive()
    {
        var promotion = Promotion.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "SIEMPRE",
            "Promo permanente",
            null,
            PromotionType.FixedAmount,
            1m,
            Now,
            null,
            priority: 0,
            isStackable: false).Value!;

        promotion.IsApplicableOn(Now.AddYears(1)).Should().BeTrue();
    }

    private static Result<Promotion> CreatePercentage(decimal value) =>
        Promotion.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "septiembre",
            "Promo septiembre",
            null,
            PromotionType.Percentage,
            value,
            Now,
            Now.AddDays(10),
            priority: 1,
            isStackable: true);
}
