using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Commands.CreateStorefrontDomain;
using EcuNexo.Business.Storefront.Commands.DeleteStorefrontDomain;
using EcuNexo.Business.Storefront.Commands.SetPrimaryStorefrontDomain;
using EcuNexo.Business.Storefront.Commands.VerifyStorefrontDomain;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class StorefrontDomainCommandHandlerTests : IDisposable
{
    private readonly IStorefrontDomainRepository _domains = Substitute.For<IStorefrontDomainRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IIdGenerator _ids = Substitute.For<IIdGenerator>();
    private readonly IDomainOwnershipVerifier _verifier = Substitute.For<IDomainOwnershipVerifier>();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());

    public void Dispose() => _cache.Dispose();

    [Fact(DisplayName = "El primer dominio de la empresa queda como principal")]
    public async Task Create_FirstDomain_BecomesPrimary()
    {
        var tenantId = Guid.CreateVersion7();
        var domainId = Guid.CreateVersion7();

        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(CreateTenant(tenantId));
        _domains.ListByTenantAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new List<StorefrontDomain>());
        _domains.DomainExistsAsync("tienda.demo.com", Arg.Any<CancellationToken>()).Returns(false);
        _ids.NewId().Returns(domainId);
        _unitOfWork.TrySaveChangesAsync(Arg.Any<CancellationToken>()).Returns(true);

        var sut = new CreateStorefrontDomainHandler(_domains, _tenants, _unitOfWork, _ids, _cache);
        var result = await sut.Handle(
            new CreateStorefrontDomainCommand(tenantId, "Tienda.Demo.com", null),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Domain.Should().Be("tienda.demo.com");
        result.Value.IsPrimary.Should().BeTrue();
        result.Value.IsVerified.Should().BeFalse();
        await _domains.Received(1).AddAsync(
            Arg.Is<StorefrontDomain>(d => d.Id == domainId),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).TrySaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "No permite registrar un dominio ya usado por otra tienda")]
    public async Task Create_DuplicateDomain_ReturnsConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var existing = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "otra.demo.com").Value!;

        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(CreateTenant(tenantId));
        _domains.ListByTenantAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new List<StorefrontDomain> { existing });
        _domains.DomainExistsAsync("tienda.demo.com", Arg.Any<CancellationToken>()).Returns(true);
        _ids.NewId().Returns(Guid.CreateVersion7());

        var sut = new CreateStorefrontDomainHandler(_domains, _tenants, _unitOfWork, _ids, _cache);
        var result = await sut.Handle(
            new CreateStorefrontDomainCommand(tenantId, "tienda.demo.com", null),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.domain.duplicate");
        result.Error.Type.Should().Be(ErrorType.Conflict);
        await _domains.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }

    [Fact(DisplayName = "No permite superar el máximo de dominios por empresa")]
    public async Task Create_LimitReached_ReturnsConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var existing = Enumerable.Range(0, StorefrontDomain.MaxPerTenant)
            .Select(index => StorefrontDomain.Create(
                Guid.CreateVersion7(),
                tenantId,
                $"tienda{index}.demo.com").Value!)
            .ToList();

        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(CreateTenant(tenantId));
        _domains.ListByTenantAsync(tenantId, Arg.Any<CancellationToken>()).Returns(existing);

        var sut = new CreateStorefrontDomainHandler(_domains, _tenants, _unitOfWork, _ids, _cache);
        var result = await sut.Handle(
            new CreateStorefrontDomainCommand(tenantId, "nueva.demo.com", null),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.domain.limit_reached");
    }

    [Fact(DisplayName = "Tenant inexistente no puede registrar dominios")]
    public async Task Create_UnknownTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var sut = new CreateStorefrontDomainHandler(_domains, _tenants, _unitOfWork, _ids, _cache);
        var result = await sut.Handle(
            new CreateStorefrontDomainCommand(tenantId, "tienda.demo.com", null),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
    }

    [Fact(DisplayName = "Verifica el dominio cuando existe el registro TXT")]
    public async Task Verify_TxtRecordFound_MarksVerified()
    {
        var tenantId = Guid.CreateVersion7();
        var domain = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "tienda.demo.com").Value!;

        _domains.GetTrackedByIdAsync(tenantId, domain.Id, Arg.Any<CancellationToken>()).Returns(domain);
        _verifier.HasTxtRecordAsync(domain.TxtRecordName, domain.TxtRecordValue, Arg.Any<CancellationToken>())
            .Returns(true);

        var sut = new VerifyStorefrontDomainHandler(_domains, _verifier, _unitOfWork, _cache);
        var result = await sut.Handle(
            new VerifyStorefrontDomainCommand(tenantId, domain.Id, null),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.IsVerified.Should().BeTrue();
        domain.IsVerified.Should().BeTrue();
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "No verifica el dominio si falta el registro TXT")]
    public async Task Verify_TxtRecordMissing_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();
        var domain = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "tienda.demo.com").Value!;

        _domains.GetTrackedByIdAsync(tenantId, domain.Id, Arg.Any<CancellationToken>()).Returns(domain);
        _verifier.HasTxtRecordAsync(domain.TxtRecordName, domain.TxtRecordValue, Arg.Any<CancellationToken>())
            .Returns(false);

        var sut = new VerifyStorefrontDomainHandler(_domains, _verifier, _unitOfWork, _cache);
        var result = await sut.Handle(
            new VerifyStorefrontDomainCommand(tenantId, domain.Id, null),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.domain.verification_failed");
        domain.IsVerified.Should().BeFalse();
        await _unitOfWork.DidNotReceiveWithAnyArgs().SaveChangesAsync(default);
    }

    [Fact(DisplayName = "Un dominio ya verificado no vuelve a consultar DNS")]
    public async Task Verify_AlreadyVerified_SkipsDnsLookup()
    {
        var tenantId = Guid.CreateVersion7();
        var domain = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "tienda.demo.com").Value!;
        domain.MarkVerified(DateTimeOffset.UtcNow);

        _domains.GetTrackedByIdAsync(tenantId, domain.Id, Arg.Any<CancellationToken>()).Returns(domain);

        var sut = new VerifyStorefrontDomainHandler(_domains, _verifier, _unitOfWork, _cache);
        var result = await sut.Handle(
            new VerifyStorefrontDomainCommand(tenantId, domain.Id, null),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _verifier.DidNotReceiveWithAnyArgs()
            .HasTxtRecordAsync(default!, default!, default);
    }

    [Fact(DisplayName = "Solo un dominio verificado puede ser principal")]
    public async Task SetPrimary_UnverifiedDomain_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();
        var domain = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "tienda.demo.com").Value!;

        _domains.GetTrackedByIdAsync(tenantId, domain.Id, Arg.Any<CancellationToken>()).Returns(domain);

        var sut = new SetPrimaryStorefrontDomainHandler(_domains, _unitOfWork);
        var result = await sut.Handle(
            new SetPrimaryStorefrontDomainCommand(tenantId, domain.Id, null),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.domain.primary_unverified");
    }

    [Fact(DisplayName = "Al fijar principal se desmarcan los demás dominios")]
    public async Task SetPrimary_VerifiedDomain_SwitchesPrimary()
    {
        var tenantId = Guid.CreateVersion7();
        var target = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "tienda.demo.com").Value!;
        target.MarkVerified(DateTimeOffset.UtcNow);
        var other = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "otra.demo.com").Value!;
        other.SetPrimary(true);

        _domains.GetTrackedByIdAsync(tenantId, target.Id, Arg.Any<CancellationToken>()).Returns(target);
        _domains.ListTrackedByTenantAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new List<StorefrontDomain> { target, other });

        var sut = new SetPrimaryStorefrontDomainHandler(_domains, _unitOfWork);
        var result = await sut.Handle(
            new SetPrimaryStorefrontDomainCommand(tenantId, target.Id, null),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        target.IsPrimary.Should().BeTrue();
        other.IsPrimary.Should().BeFalse();
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Eliminar un dominio invalida su caché de resolución")]
    public async Task Delete_RemovesDomainAndInvalidatesCache()
    {
        var tenantId = Guid.CreateVersion7();
        var domain = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "tienda.demo.com").Value!;
        var cacheKey = StorefrontCacheKeys.ForHost(domain.Domain);
        _cache.Set(cacheKey, "cached");

        _domains.GetTrackedByIdAsync(tenantId, domain.Id, Arg.Any<CancellationToken>()).Returns(domain);

        var sut = new DeleteStorefrontDomainHandler(_domains, _unitOfWork, _cache);
        var result = await sut.Handle(
            new DeleteStorefrontDomainCommand(tenantId, domain.Id, null),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
        _domains.Received(1).Remove(domain);
        _cache.TryGetValue(cacheKey, out _).Should().BeFalse();
    }

    private static Tenant CreateTenant(Guid tenantId) =>
        Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!;
}
