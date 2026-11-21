using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Logistics.Queries.ListEcuadorProvinces;

public sealed record ListEcuadorProvincesQuery : IQuery<IReadOnlyList<EcuadorProvinceResponse>>;

public sealed record EcuadorProvinceResponse(
    Guid Id,
    string Code,
    string Name,
    string Region,
    int SortOrder);

public sealed class ListEcuadorProvincesHandler
    : IQueryHandler<ListEcuadorProvincesQuery, IReadOnlyList<EcuadorProvinceResponse>>
{
    private readonly IEcuadorGeoRepository _geo;

    public ListEcuadorProvincesHandler(IEcuadorGeoRepository geo)
    {
        _geo = geo;
    }

    public async Task<Result<IReadOnlyList<EcuadorProvinceResponse>>> Handle(
        ListEcuadorProvincesQuery query,
        CancellationToken ct)
    {
        var provinces = await _geo.ListProvincesAsync(ct).ConfigureAwait(false);
        IReadOnlyList<EcuadorProvinceResponse> result = provinces
            .Select(p => new EcuadorProvinceResponse(p.Id, p.Code, p.Name, p.Region, p.SortOrder))
            .ToList();
        return Result.Success(result);
    }
}
