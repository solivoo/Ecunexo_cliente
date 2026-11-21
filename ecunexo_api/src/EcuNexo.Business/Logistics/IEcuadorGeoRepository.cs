using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics;

public interface IEcuadorGeoRepository
{
    Task<IReadOnlyList<EcuadorProvince>> ListProvincesAsync(CancellationToken ct);

    Task<IReadOnlyList<EcuadorCanton>> ListCantonsByProvinceAsync(Guid provinceId, CancellationToken ct);

    Task<EcuadorCanton?> GetCantonByIdAsync(Guid cantonId, CancellationToken ct);

    Task<bool> AnyProvincesAsync(CancellationToken ct);
}
