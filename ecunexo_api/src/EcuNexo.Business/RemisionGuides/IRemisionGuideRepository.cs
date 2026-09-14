using EcuNexo.Core.RemisionGuides;

namespace EcuNexo.Business.RemisionGuides;

public interface IRemisionGuideRepository
{
    Task<RemisionGuide?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct = default);

    Task<bool> ExistsSequentialAsync(
        Guid tenantId,
        string establishment,
        string emissionPoint,
        string sequential,
        Guid? excludeId = null,
        CancellationToken ct = default);

    Task<string> GetNextSequentialAsync(
        Guid tenantId,
        string establishment,
        string emissionPoint,
        CancellationToken ct = default);

    Task<IReadOnlyList<RemisionGuide>> ListAsync(
        Guid tenantId,
        RemisionGuideStatus? status = null,
        DateOnly? from = null,
        DateOnly? to = null,
        string? search = null,
        CancellationToken ct = default);

    Task AddAsync(RemisionGuide guide, CancellationToken ct = default);

    Task UpdateAsync(RemisionGuide guide, CancellationToken ct = default);
}
