using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.ListVolumeDiscountSchemes;

public sealed record ListVolumeDiscountSchemesQuery(Guid TenantId, bool OnlyActive = true)
    : IQuery<IReadOnlyList<VolumeDiscountSchemeResponse>>;

public sealed class ListVolumeDiscountSchemesHandler
    : IQueryHandler<ListVolumeDiscountSchemesQuery, IReadOnlyList<VolumeDiscountSchemeResponse>>
{
    private readonly IVolumeDiscountSchemeRepository _schemes;

    public ListVolumeDiscountSchemesHandler(IVolumeDiscountSchemeRepository schemes)
    {
        _schemes = schemes;
    }

    public async Task<Result<IReadOnlyList<VolumeDiscountSchemeResponse>>> Handle(
        ListVolumeDiscountSchemesQuery query,
        CancellationToken ct)
    {
        var schemes = await _schemes.ListAsync(query.TenantId, query.OnlyActive, ct).ConfigureAwait(false);

        IReadOnlyList<VolumeDiscountSchemeResponse> response = schemes
            .Select(s => new VolumeDiscountSchemeResponse(
                s.Id,
                s.Name,
                s.Description,
                s.Type,
                s.IsActive,
                s.Tiers.Select(t => new VolumeDiscountTierResponse(
                    t.Id,
                    t.QuantityFrom,
                    t.QuantityTo,
                    t.Value,
                    t.IsActive)).ToList()))
            .ToList();

        return Result.Success(response);
    }
}
