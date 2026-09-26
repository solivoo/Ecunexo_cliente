using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.ResolveStorefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class ResolveStorefrontHandlerTests : IDisposable
{
    private readonly IStorefrontDomainRepository _domains = Substitute.For<IStorefrontDomainRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());

    public void Dispose() => _cache.Dispose();

    [Fact(DisplayName = "Resuelve el host verificado con branding y cachea la respuesta")]
    public async Task Handle_VerifiedHost_ReturnsBrandingConfig()
    {
        var tenantId = Guid.CreateVersion7();
        var tenant = Tenant.Create(
            tenantId,
            "Tienda Demo",
            new ServicePlan("Small", 3, 1),
            locale: "es-EC",
            logoUrl: "/api/v1/tenants/t/brand-logos/l/file",
            primaryColorHex: "#2563eb",
            moduleEntitlements: new List<ModuleEntitlement>
            {
                ModuleEntitlement.FromTier(TenantModuleCodes.Ecommerce, ModuleTier.Small),
            }).Value!;

        var domain = StorefrontDomain.Create(
            Guid.CreateVersion7(),
            tenantId,
            "tienda.demo.com").Value!;
        domain.MarkVerified(DateTimeOffset.UtcNow);

        _domains.GetVerifiedByHostAsync("tienda.demo.com", Arg.Any<CancellationToken>())
            .Returns(domain);
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var sut = new ResolveStorefrontHandler(_domains, _tenants, _cache);
        var result = await sut.Handle(new ResolveStorefrontQuery("Tienda.Demo.com."), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TenantId.Should().Be(tenantId);
        result.Value.Name.Should().Be("Tienda Demo");
        result.Value.LogoUrl.Should().Be("/api/v1/tenants/t/brand-logos/l/file");
        result.Value.PrimaryColorHex.Should().Be("#2563eb");
        result.Value.Locale.Should().Be("es-EC");
        result.Value.Currency.Should().Be("USD");

        await sut.Handle(new ResolveStorefrontQuery("tienda.demo.com"), CancellationToken.None);
        await _domains.Received(1).GetVerifiedByHostAsync("tienda.demo.com", Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Host no registrado no expone la tienda")]
    public async Task Handle_UnknownHost_ReturnsNotFound()
    {
        _domains.GetVerifiedByHostAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((StorefrontDomain?)null);

        var sut = new ResolveStorefrontHandler(_domains, _tenants, _cache);
        var result = await sut.Handle(new ResolveStorefrontQuery("tienda.demo.com"), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
    }

    [Fact(DisplayName = "Host inválido ni siquiera consulta la base")]
    public async Task Handle_InvalidHost_ReturnsNotFound()
    {
        var sut = new ResolveStorefrontHandler(_domains, _tenants, _cache);
        var result = await sut.Handle(new ResolveStorefrontQuery("localhost"), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        await _domains.DidNotReceiveWithAnyArgs()
            .GetVerifiedByHostAsync(default!, default);
    }

    [Fact(DisplayName = "Tenant cancelado no expone la tienda")]
    public async Task Handle_CancelledTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var tenant = Tenant.Create(
            tenantId,
            "Tienda Demo",
            new ServicePlan("Small", 3, 1),
            moduleEntitlements: new List<ModuleEntitlement>
            {
                ModuleEntitlement.FromTier(TenantModuleCodes.Ecommerce, ModuleTier.Small),
            }).Value!;
        tenant.Cancel();

        var domain = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "tienda.demo.com").Value!;
        domain.MarkVerified(DateTimeOffset.UtcNow);

        _domains.GetVerifiedByHostAsync("tienda.demo.com", Arg.Any<CancellationToken>()).Returns(domain);
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var sut = new ResolveStorefrontHandler(_domains, _tenants, _cache);
        var result = await sut.Handle(new ResolveStorefrontQuery("tienda.demo.com"), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
    }

    [Fact(DisplayName = "Tenant sin módulo ecommerce no expone la tienda")]
    public async Task Handle_TenantWithoutEcommerce_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var tenant = Tenant.Create(
            tenantId,
            "Tienda Demo",
            new ServicePlan("Small", 3, 1),
            moduleEntitlements: new List<ModuleEntitlement>
            {
                ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Small),
            }).Value!;

        var domain = StorefrontDomain.Create(Guid.CreateVersion7(), tenantId, "tienda.demo.com").Value!;
        domain.MarkVerified(DateTimeOffset.UtcNow);

        _domains.GetVerifiedByHostAsync("tienda.demo.com", Arg.Any<CancellationToken>()).Returns(domain);
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var sut = new ResolveStorefrontHandler(_domains, _tenants, _cache);
        var result = await sut.Handle(new ResolveStorefrontQuery("tienda.demo.com"), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
    }
}
