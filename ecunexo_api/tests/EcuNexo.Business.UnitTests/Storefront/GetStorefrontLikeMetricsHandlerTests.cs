using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.GetStorefrontLikeMetrics;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class GetStorefrontLikeMetricsHandlerTests
{
    private readonly IStorefrontProductLikeRepository _likes = Substitute.For<IStorefrontProductLikeRepository>();
    private readonly GetStorefrontLikeMetricsHandler _sut;

    public GetStorefrontLikeMetricsHandlerTests()
    {
        _sut = new GetStorefrontLikeMetricsHandler(_likes);
    }

    [Fact(DisplayName = "Devuelve total, top y serie diaria del período")]
    public async Task Handle_ReturnsMetrics()
    {
        var tenantId = Guid.CreateVersion7();
        var daily = new List<StorefrontLikeDailyPointDto>
        {
            new(new DateOnly(2026, 1, 1), 2),
            new(new DateOnly(2026, 1, 2), 0),
        };
        var metrics = new StorefrontLikeMetricsDto(
            9,
            new List<StorefrontLikeTopProductDto>
            {
                new(Guid.CreateVersion7(), "Calcetín Runner", 6),
            },
            daily);

        DateTimeOffset from = default;
        DateTimeOffset to = default;
        var limit = 0;
        _likes
            .ListMetricsAsync(
                tenantId,
                Arg.Any<DateTimeOffset>(),
                Arg.Any<DateTimeOffset>(),
                Arg.Any<int>(),
                Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                from = callInfo.ArgAt<DateTimeOffset>(1);
                to = callInfo.ArgAt<DateTimeOffset>(2);
                limit = callInfo.ArgAt<int>(3);
                return metrics;
            });

        var result = await _sut.Handle(
            new GetStorefrontLikeMetricsQuery(tenantId, Days: 30),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeSameAs(metrics);
        limit.Should().Be(5);

        var window = to - from;
        window.TotalDays.Should().BeGreaterThanOrEqualTo(29);
        window.TotalDays.Should().BeLessThan(30);
    }

    [Fact(DisplayName = "Los días se acotan al rango 1..365")]
    public async Task Handle_ClampsDays()
    {
        var tenantId = Guid.CreateVersion7();
        var windows = new List<(DateTimeOffset From, DateTimeOffset To)>();
        _likes
            .ListMetricsAsync(
                tenantId,
                Arg.Any<DateTimeOffset>(),
                Arg.Any<DateTimeOffset>(),
                Arg.Any<int>(),
                Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                windows.Add((
                    callInfo.ArgAt<DateTimeOffset>(1),
                    callInfo.ArgAt<DateTimeOffset>(2)));
                return new StorefrontLikeMetricsDto(
                    0,
                    Array.Empty<StorefrontLikeTopProductDto>(),
                    Array.Empty<StorefrontLikeDailyPointDto>());
            });

        var low = await _sut.Handle(new GetStorefrontLikeMetricsQuery(tenantId, Days: 0), CancellationToken.None);
        var high = await _sut.Handle(new GetStorefrontLikeMetricsQuery(tenantId, Days: 9999), CancellationToken.None);

        low.IsSuccess.Should().BeTrue();
        high.IsSuccess.Should().BeTrue();
        windows.Should().HaveCount(2);

        var lowSpan = windows[0].To - windows[0].From;
        lowSpan.TotalDays.Should().BeGreaterThanOrEqualTo(0);
        lowSpan.TotalDays.Should().BeLessThan(1);

        var highSpan = windows[1].To - windows[1].From;
        highSpan.TotalDays.Should().BeGreaterThanOrEqualTo(GetStorefrontLikeMetricsHandler.MaxDays - 1);
        highSpan.TotalDays.Should().BeLessThan(GetStorefrontLikeMetricsHandler.MaxDays);
    }
}
