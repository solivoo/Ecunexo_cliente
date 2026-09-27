using EcuNexo.Business.Storefront;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class StorefrontLikeMetricsCalculatorTests
{
    private static readonly DateTimeOffset From = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset To = new(2026, 1, 4, 12, 0, 0, TimeSpan.Zero);

    [Fact(DisplayName = "Calcula total, top ordenado y serie diaria con días vacíos")]
    public void Build_ComputesTotalTopAndDaily()
    {
        var alpha = Guid.CreateVersion7();
        var beta = Guid.CreateVersion7();
        var gamma = Guid.CreateVersion7();
        var rows = new List<StorefrontLikeRow>
        {
            new(alpha, "Alfa", From.AddHours(1)),
            new(alpha, "Alfa", From.AddDays(1)),
            new(alpha, "Alfa", From.AddDays(1).AddHours(2)),
            new(beta, "Beta", From.AddDays(2)),
            new(gamma, "Gamma", From.AddDays(3)),
        };

        var metrics = StorefrontLikeMetricsCalculator.Build(rows, From, To, top: 5);

        metrics.TotalLikes.Should().Be(5);
        metrics.TopProducts.Select(p => (p.Name, p.LikeCount)).Should().Equal(
            ("Alfa", 3),
            ("Beta", 1),
            ("Gamma", 1));
        metrics.Daily.Should().HaveCount(4);
        metrics.Daily.Select(d => d.Date).Should().Equal(
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 1, 2),
            new DateOnly(2026, 1, 3),
            new DateOnly(2026, 1, 4));
        metrics.Daily.Select(d => d.Count).Should().Equal(1, 2, 1, 1);
    }

    [Fact(DisplayName = "El top respeta el límite y desempata por nombre")]
    public void Build_LimitsTopAndOrdersByName()
    {
        var zulu = Guid.CreateVersion7();
        var alfa = Guid.CreateVersion7();
        var beta = Guid.CreateVersion7();
        var rows = new List<StorefrontLikeRow>
        {
            new(zulu, "Zulu", From),
            new(alfa, "Alfa", From),
            new(beta, "Beta", From),
        };

        var metrics = StorefrontLikeMetricsCalculator.Build(rows, From, To, top: 2);

        metrics.TopProducts.Should().HaveCount(2);
        metrics.TopProducts.Select(p => p.Name).Should().Equal("Alfa", "Beta");
    }

    [Fact(DisplayName = "Serie diaria incluye días sin likes en cero")]
    public void Build_ZeroFillsDaysWithoutLikes()
    {
        var metrics = StorefrontLikeMetricsCalculator.Build(
            Array.Empty<StorefrontLikeRow>(),
            From,
            From.AddDays(2),
            top: 5);

        metrics.TotalLikes.Should().Be(0);
        metrics.TopProducts.Should().BeEmpty();
        metrics.Daily.Select(d => d.Count).Should().Equal(0, 0, 0);
    }
}
