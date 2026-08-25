using EcuNexo.Core.Platform.Navigation;

namespace EcuNexo.Business.Platform;

public interface IMenuItemRepository
{
    Task<IReadOnlyList<MenuItem>> ListActiveAsync(
        MenuContextKind? context,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MenuItem>> ListAsync(
        MenuContextKind? context,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<MenuItem?> GetByIdAsync(string id, CancellationToken cancellationToken = default);

    Task AddAsync(MenuItem item, CancellationToken cancellationToken = default);

    Task UpdateAsync(MenuItem item, CancellationToken cancellationToken = default);

    Task DeleteAsync(string id, CancellationToken cancellationToken = default);
}
