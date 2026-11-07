using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.ApiKeys.Queries.ListTenantApiKeys;

public sealed record ListTenantApiKeysQuery(Guid TenantId) : IQuery<IReadOnlyList<TenantApiKeyItemDto>>;

public sealed class ListTenantApiKeysHandler(
    ITenantApiKeyRepository apiKeys) : IQueryHandler<ListTenantApiKeysQuery, IReadOnlyList<TenantApiKeyItemDto>>
{
    public async Task<Result<IReadOnlyList<TenantApiKeyItemDto>>> Handle(
        ListTenantApiKeysQuery query,
        CancellationToken ct)
    {
        var items = await apiKeys.ListByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        var utcNow = DateTimeOffset.UtcNow;

        var result = items
            .Select(k =>
            {
                var status = k.RevokedAt.HasValue
                    ? "revoked"
                    : k.ExpiresAt.HasValue && k.ExpiresAt.Value <= utcNow
                        ? "expired"
                        : "active";

                return new TenantApiKeyItemDto(
                    k.Id,
                    k.TenantId,
                    k.Name,
                    k.KeyPrefix,
                    k.Scopes,
                    k.CreatedAt,
                    k.CreatedBy,
                    k.ExpiresAt,
                    k.RevokedAt,
                    k.LastUsedAt,
                    status);
            })
            .ToList();

        return Result.Success<IReadOnlyList<TenantApiKeyItemDto>>(result);
    }
}
