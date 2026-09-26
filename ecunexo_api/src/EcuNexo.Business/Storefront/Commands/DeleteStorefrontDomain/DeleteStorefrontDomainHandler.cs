using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using Microsoft.Extensions.Caching.Memory;

namespace EcuNexo.Business.Storefront.Commands.DeleteStorefrontDomain;

public sealed class DeleteStorefrontDomainHandler
    : ICommandHandler<DeleteStorefrontDomainCommand, bool>
{
    private readonly IStorefrontDomainRepository _domains;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMemoryCache _cache;

    public DeleteStorefrontDomainHandler(
        IStorefrontDomainRepository domains,
        IUnitOfWork unitOfWork,
        IMemoryCache cache)
    {
        _domains = domains;
        _unitOfWork = unitOfWork;
        _cache = cache;
    }

    public async Task<Result<bool>> Handle(
        DeleteStorefrontDomainCommand command,
        CancellationToken ct)
    {
        var domain = await _domains
            .GetTrackedByIdAsync(command.TenantId, command.DomainId, ct)
            .ConfigureAwait(false);
        if (domain is null)
        {
            return Result.Failure<bool>(
                new Error(
                    "storefront.domain.not_found",
                    "El dominio no existe para esta empresa.",
                    ErrorType.NotFound));
        }

        _domains.Remove(domain);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        _cache.Remove(StorefrontCacheKeys.ForHost(domain.Domain));

        return Result.Success(true);
    }
}
