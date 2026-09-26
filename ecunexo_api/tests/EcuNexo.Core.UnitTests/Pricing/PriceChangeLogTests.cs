using EcuNexo.Core.Pricing;

namespace EcuNexo.Core.UnitTests.Pricing;

public sealed class PriceChangeLogTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "Registro de cambio de precio válido")]
    public void Create_ValidEntry_Succeeds()
    {
        var result = PriceChangeLog.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            previousPrice: 10m,
            newPrice: 12m,
            Today,
            null,
            "Ajuste por inflación");

        result.IsSuccess.Should().BeTrue();
        result.Value!.PreviousPrice.Should().Be(10m);
        result.Value!.NewPrice.Should().Be(12m);
        result.Value!.Reason.Should().Be("Ajuste por inflación");
        result.Value!.ChangedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact(DisplayName = "Un precio negativo en el historial es rechazado")]
    public void Create_NegativePrice_Fails()
    {
        var result = PriceChangeLog.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            previousPrice: -1m,
            newPrice: 12m,
            Today,
            null,
            null);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.history.price.range");
    }

    [Fact(DisplayName = "Un motivo demasiado largo es rechazado")]
    public void Create_LongReason_Fails()
    {
        var result = PriceChangeLog.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            previousPrice: null,
            newPrice: 12m,
            Today,
            null,
            new string('x', PriceChangeLog.ReasonMaxLength + 1));

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.history.reason.length");
    }
}
