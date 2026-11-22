using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Logistics.Queries.ListEcuadorCantons;

public sealed record ListEcuadorCantonsQuery(Guid ProvinceId)
    : IQuery<IReadOnlyList<EcuadorCantonResponse>>;

public sealed record EcuadorCantonResponse(
    Guid Id,
    Guid ProvinceId,
    string Code,
    string Name,
    bool IsProvincialCapital,
    int SortOrder);

public sealed class ListEcuadorCantonsHandler
    : IQueryHandler<ListEcuadorCantonsQuery, IReadOnlyList<EcuadorCantonResponse>>
{
    private readonly IEcuadorGeoRepository _geo;

    public ListEcuadorCantonsHandler(IEcuadorGeoRepository geo)
    {
        _geo = geo;
    }

    public async Task<Result<IReadOnlyList<EcuadorCantonResponse>>> Handle(
        ListEcuadorCantonsQuery query,
        CancellationToken ct)
    {
        if (query.ProvinceId == Guid.Empty)
        {
            return Result.Failure<IReadOnlyList<EcuadorCantonResponse>>(
                new Error("logistics.geo.province_required", "La provincia es obligatoria.", ErrorType.Validation));
        }

        var cantons = await _geo.ListCantonsByProvinceAsync(query.ProvinceId, ct).ConfigureAwait(false);
        IReadOnlyList<EcuadorCantonResponse> result = cantons
            .Select(c => new EcuadorCantonResponse(
                c.Id,
                c.ProvinceId,
                c.Code,
                c.Name,
                c.IsProvincialCapital,
                c.SortOrder))
            .ToList();

        return Result.Success(result);
    }
}
