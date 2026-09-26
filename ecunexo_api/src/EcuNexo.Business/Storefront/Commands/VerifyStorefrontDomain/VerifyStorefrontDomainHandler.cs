using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using Microsoft.Extensions.Caching.Memory;

namespace EcuNexo.Business.Storefront.Commands.VerifyStorefrontDomain;

public sealed class VerifyStorefrontDomainHandler
    : ICommandHandler<VerifyStorefrontDomainCommand, StorefrontDomainDto>
{
    private readonly IStorefrontDomainRepository _domains;
    private readonly IDomainOwnershipVerifier _verifier;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMemoryCache _cache;

    public VerifyStorefrontDomainHandler(
        IStorefrontDomainRepository domains,
        IDomainOwnershipVerifier verifier,
        IUnitOfWork unitOfWork,
        IMemoryCache cache)
    {
        _domains = domains;
        _verifier = verifier;
        _unitOfWork = unitOfWork;
        _cache = cache;
    }

    public async Task<Result<StorefrontDomainDto>> Handle(
        VerifyStorefrontDomainCommand command,
        CancellationToken ct)
    {
        var domain = await _domains
            .GetTrackedByIdAsync(command.TenantId, command.DomainId, ct)
            .ConfigureAwait(false);
        if (domain is null)
        {
            return Result.Failure<StorefrontDomainDto>(DomainNotFound());
        }

        if (!domain.IsVerified)
        {
            var verified = await _verifier
                .HasTxtRecordAsync(domain.TxtRecordName, domain.TxtRecordValue, ct)
                .ConfigureAwait(false);
            if (!verified)
            {
                return Result.Failure<StorefrontDomainDto>(
                    new Error(
                        "storefront.domain.verification_failed",
                        $"No encontramos el registro TXT «{domain.TxtRecordName}» con el valor «{domain.TxtRecordValue}». Verifica el DNS y reintenta.",
                        ErrorType.Validation));
            }

            domain.MarkVerified(DateTimeOffset.UtcNow, command.UserId);
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        }

        _cache.Remove(StorefrontCacheKeys.ForHost(domain.Domain));
        return Result.Success(StorefrontDomainDto.FromEntity(domain));
    }

    private static Error DomainNotFound() =>
        new(
            "storefront.domain.not_found",
            "El dominio no existe para esta empresa.",
            ErrorType.NotFound);
}
