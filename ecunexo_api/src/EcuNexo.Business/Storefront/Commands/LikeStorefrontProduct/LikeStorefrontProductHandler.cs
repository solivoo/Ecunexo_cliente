using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Storefront.Commands.LikeStorefrontProduct;

public sealed class LikeStorefrontProductHandler
    : ICommandHandler<LikeStorefrontProductCommand, StorefrontProductLikeDto>
{
    private readonly IStorefrontCatalogRepository _catalog;
    private readonly IStorefrontProductLikeRepository _likes;
    private readonly ITenantRepository _tenants;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public LikeStorefrontProductHandler(
        IStorefrontCatalogRepository catalog,
        IStorefrontProductLikeRepository likes,
        ITenantRepository tenants,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _catalog = catalog;
        _likes = likes;
        _tenants = tenants;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<StorefrontProductLikeDto>> Handle(
        LikeStorefrontProductCommand command,
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

        var alreadyLiked = await _likes
            .ExistsAsync(command.TenantId, product.Id, visitorId, ct)
            .ConfigureAwait(false);

        if (!alreadyLiked)
        {
            var created = StorefrontProductLike.Create(
                _idGenerator.NewId(),
                command.TenantId,
                product.Id,
                visitorId);

            if (created.IsFailure)
            {
                return Result.Failure<StorefrontProductLikeDto>(created.Error!);
            }

            await _likes.AddAsync(created.Value!, ct).ConfigureAwait(false);
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        }

        var likeCount = await _likes
            .CountForItemAsync(command.TenantId, product.Id, ct)
            .ConfigureAwait(false);

        return Result.Success(new StorefrontProductLikeDto(Liked: true, LikeCount: likeCount));
    }
}
