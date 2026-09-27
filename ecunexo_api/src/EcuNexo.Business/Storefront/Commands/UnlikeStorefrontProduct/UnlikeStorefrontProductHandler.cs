using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront.Commands.LikeStorefrontProduct;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Commands.UnlikeStorefrontProduct;

public sealed class UnlikeStorefrontProductHandler
    : ICommandHandler<UnlikeStorefrontProductCommand, StorefrontProductLikeDto>
{
    private readonly IStorefrontCatalogRepository _catalog;
    private readonly IStorefrontProductLikeRepository _likes;
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;

    public UnlikeStorefrontProductHandler(
        IStorefrontCatalogRepository catalog,
        IStorefrontProductLikeRepository likes,
        ITenantRepository tenants,
        IUnitOfWork unitOfWork)
    {
        _catalog = catalog;
        _likes = likes;
        _tenants = tenants;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<StorefrontProductLikeDto>> Handle(
        UnlikeStorefrontProductCommand command,
        CancellationToken ct)
    {
        var visitorResult = StorefrontLikeRules.NormalizeVisitorId(command.VisitorId);
        if (visitorResult.IsFailure)
        {
            return Result.Failure<StorefrontProductLikeDto>(visitorResult.Error!);
        }

        var visitorId = visitorResult.Value!;

        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, command.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<StorefrontProductLikeDto>(tenantError);
        }

        var product = await _catalog
            .FindActiveRootAsync(command.TenantId, command.ProductId, ct)
            .ConfigureAwait(false);
        if (product is null)
        {
            return Result.Failure<StorefrontProductLikeDto>(StorefrontTenantGuard.ProductNotFound);
        }

        var removed = await _likes
            .RemoveAsync(command.TenantId, product.Id, visitorId, ct)
            .ConfigureAwait(false);

        if (removed)
        {
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        }

        var likeCount = await _likes
            .CountForItemAsync(command.TenantId, product.Id, ct)
            .ConfigureAwait(false);

        return Result.Success(new StorefrontProductLikeDto(Liked: false, LikeCount: likeCount));
    }
}
