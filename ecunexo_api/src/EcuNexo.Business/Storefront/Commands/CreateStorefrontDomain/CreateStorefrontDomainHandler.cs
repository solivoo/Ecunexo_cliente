using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Caching.Memory;

namespace EcuNexo.Business.Storefront.Commands.CreateStorefrontDomain;

public sealed class CreateStorefrontDomainHandler
    : ICommandHandler<CreateStorefrontDomainCommand, StorefrontDomainDto>
{
    private readonly IStorefrontDomainRepository _domains;
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IIdGenerator _idGenerator;
    private readonly IMemoryCache _cache;

    public CreateStorefrontDomainHandler(
        IStorefrontDomainRepository domains,
        ITenantRepository tenants,
        IUnitOfWork unitOfWork,
        IIdGenerator idGenerator,
        IMemoryCache cache)
    {
        _domains = domains;
        _tenants = tenants;
        _unitOfWork = unitOfWork;
        _idGenerator = idGenerator;
        _cache = cache;
    }

    public async Task<Result<StorefrontDomainDto>> Handle(
        CreateStorefrontDomainCommand command,
        CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null || tenant.Status is TenantStatus.Cancelled)
        {
            return Result.Failure<StorefrontDomainDto>(StorefrontTenantGuard.TenantNotFound);
        }

        var existing = await _domains
            .ListByTenantAsync(command.TenantId, ct)
            .ConfigureAwait(false);
        if (existing.Count >= StorefrontDomain.MaxPerTenant)
        {
            return Result.Failure<StorefrontDomainDto>(
                new Error(
                    "storefront.domain.limit_reached",
                    $"La empresa ya alcanzó el máximo de {StorefrontDomain.MaxPerTenant} dominios.",
                    ErrorType.Conflict));
        }

        var created = StorefrontDomain.Create(
            _idGenerator.NewId(),
            command.TenantId,
            command.Domain,
            command.UserId);
        if (created.IsFailure)
        {
            return Result.Failure<StorefrontDomainDto>(created.Error!);
        }

        var domain = created.Value!;
        if (await _domains.DomainExistsAsync(domain.Domain, ct).ConfigureAwait(false))
        {
            return Result.Failure<StorefrontDomainDto>(DuplicateError(domain.Domain));
        }

        if (existing.Count == 0)
        {
            domain.SetPrimary(true, command.UserId);
        }

        await _domains.AddAsync(domain, ct).ConfigureAwait(false);
        var saved = await _unitOfWork.TrySaveChangesAsync(ct).ConfigureAwait(false);
        if (!saved)
        {
            return Result.Failure<StorefrontDomainDto>(DuplicateError(domain.Domain));
        }

        _cache.Remove(StorefrontCacheKeys.ForHost(domain.Domain));
        return Result.Success(StorefrontDomainDto.FromEntity(domain));
    }

    private static Error DuplicateError(string domain) =>
        new(
            "storefront.domain.duplicate",
            $"El dominio «{domain}» ya está registrado en otra tienda.",
            ErrorType.Conflict);
}
