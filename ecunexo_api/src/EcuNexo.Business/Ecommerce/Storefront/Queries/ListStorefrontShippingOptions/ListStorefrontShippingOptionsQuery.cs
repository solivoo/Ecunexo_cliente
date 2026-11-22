using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.ListStorefrontShippingOptions;

public sealed record ListStorefrontShippingOptionsQuery(
    Guid TenantId,
    Guid CantonId,
    decimal OrderSubtotal = 0m) : IQuery<IReadOnlyList<StorefrontShippingOptionDto>>;

public sealed class ListStorefrontShippingOptionsHandler
    : IQueryHandler<ListStorefrontShippingOptionsQuery, IReadOnlyList<StorefrontShippingOptionDto>>
{
    private readonly ITenantRepository _tenants;
    private readonly IStorefrontShippingService _shipping;

    public ListStorefrontShippingOptionsHandler(
        ITenantRepository tenants,
        IStorefrontShippingService shipping)
    {
        _tenants = tenants;
        _shipping = shipping;
    }

    public async Task<Result<IReadOnlyList<StorefrontShippingOptionDto>>> Handle(
        ListStorefrontShippingOptionsQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<IReadOnlyList<StorefrontShippingOptionDto>>(tenantError);
        }

        if (query.CantonId == Guid.Empty)
        {
            return Result.Failure<IReadOnlyList<StorefrontShippingOptionDto>>(
                new Error("ecommerce.checkout.canton_required", "Selecciona un cantón de entrega.", ErrorType.Validation));
        }

        var options = await _shipping
            .ListOptionsForCantonAsync(query.TenantId, query.CantonId, query.OrderSubtotal, ct)
            .ConfigureAwait(false);

        return Result.Success(options);
    }
}
