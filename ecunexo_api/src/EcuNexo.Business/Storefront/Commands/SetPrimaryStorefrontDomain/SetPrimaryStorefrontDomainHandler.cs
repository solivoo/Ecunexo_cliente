using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Commands.SetPrimaryStorefrontDomain;

public sealed class SetPrimaryStorefrontDomainHandler
    : ICommandHandler<SetPrimaryStorefrontDomainCommand, StorefrontDomainDto>
{
    private readonly IStorefrontDomainRepository _domains;
    private readonly IUnitOfWork _unitOfWork;

    public SetPrimaryStorefrontDomainHandler(
        IStorefrontDomainRepository domains,
        IUnitOfWork unitOfWork)
    {
        _domains = domains;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<StorefrontDomainDto>> Handle(
        SetPrimaryStorefrontDomainCommand command,
        CancellationToken ct)
    {
        var target = await _domains
            .GetTrackedByIdAsync(command.TenantId, command.DomainId, ct)
            .ConfigureAwait(false);
        if (target is null)
        {
            return Result.Failure<StorefrontDomainDto>(DomainNotFound());
        }

        if (!target.IsVerified)
        {
            return Result.Failure<StorefrontDomainDto>(
                new Error(
                    "storefront.domain.primary_unverified",
                    "Solo un dominio verificado puede ser el principal.",
                    ErrorType.Validation));
        }

        var domains = await _domains
            .ListTrackedByTenantAsync(command.TenantId, ct)
            .ConfigureAwait(false);

        foreach (var domain in domains)
        {
            domain.SetPrimary(domain.Id == target.Id, command.UserId);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(StorefrontDomainDto.FromEntity(target));
    }

    private static Error DomainNotFound() =>
        new(
            "storefront.domain.not_found",
            "El dominio no existe para esta empresa.",
            ErrorType.NotFound);
}
