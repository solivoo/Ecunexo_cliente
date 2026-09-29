using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.GetVolumeDiscountScheme;

public sealed record GetVolumeDiscountSchemeQuery(Guid TenantId, Guid SchemeId)
    : IQuery<VolumeDiscountSchemeResponse>;

public sealed class GetVolumeDiscountSchemeHandler
    : IQueryHandler<GetVolumeDiscountSchemeQuery, VolumeDiscountSchemeResponse>
{
    private readonly IVolumeDiscountSchemeRepository _schemes;

    public GetVolumeDiscountSchemeHandler(IVolumeDiscountSchemeRepository schemes)
    {
        _schemes = schemes;
    }

    public async Task<Result<VolumeDiscountSchemeResponse>> Handle(
        GetVolumeDiscountSchemeQuery query,
        CancellationToken ct)
    {
        var scheme = await _schemes.GetByIdAsync(query.TenantId, query.SchemeId, ct).ConfigureAwait(false);
        if (scheme is null)
        {
            return Result.Failure<VolumeDiscountSchemeResponse>(
                new Error("catalog.pricing.volume_scheme.not_found", "El esquema de descuento no existe.", ErrorType.NotFound));
        }

        var response = new VolumeDiscountSchemeResponse(
            scheme.Id,
            scheme.Name,
            scheme.Description,
            scheme.Type,
            scheme.IsActive,
            scheme.Tiers.Select(t => new VolumeDiscountTierResponse(
                t.Id,
                t.QuantityFrom,
                t.QuantityTo,
                t.Value,
                t.IsActive)).ToList());

        return Result.Success(response);
    }
}
