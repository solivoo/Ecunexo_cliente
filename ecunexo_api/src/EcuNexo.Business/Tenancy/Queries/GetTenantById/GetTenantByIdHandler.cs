using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Queries.GetTenantById;

public sealed class GetTenantByIdHandler(EcuNexo.Business.Tenancy.ITenantRepository tenants)
    : IQueryHandler<GetTenantByIdQuery, GetTenantByIdResponse>
{
    public async Task<Result<GetTenantByIdResponse>> Handle(GetTenantByIdQuery query, CancellationToken ct)
    {
        var t = await tenants.GetByIdAsync(query.TenantId, ct).ConfigureAwait(false);
        if (t is null)
        {
            return Result.Failure<GetTenantByIdResponse>(
                new Error("tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        return TenantDetailMapper.Map(t);
    }
}
