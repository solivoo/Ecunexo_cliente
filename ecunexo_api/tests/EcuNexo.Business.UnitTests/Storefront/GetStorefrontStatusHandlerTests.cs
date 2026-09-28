using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.GetStorefrontStatus;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class GetStorefrontStatusHandlerTests : IDisposable
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IStorefrontCatalogRepository _catalog = Substitute.For<IStorefrontCatalogRepository>();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());

    public void Dispose() => _cache.Dispose();

    [Fact(DisplayName = "Devuelve la revisión de la última modificación del catálogo")]
    public async Task Handle_ReturnsRevision()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);
        var lastChange = new DateTimeOffset(2026, 9, 27, 12, 0, 0, TimeSpan.Zero);
        _catalog
            .GetLastCatalogChangeAtAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(lastChange);

        var sut = new GetStorefrontStatusHandler(_tenants, _catalog, _cache);
        var result = await sut.Handle(new GetStorefrontStatusQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Revision.Should().Be(lastChange.UtcTicks.ToString(System.Globalization.CultureInfo.InvariantCulture));
        result.Value.UpdatedAt.Should().Be(lastChange);
    }

    [Fact(DisplayName = "La segunda consulta dentro del TTL usa caché y no golpea la base")]
    public async Task Handle_SecondCall_UsesCache()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);
        _catalog
            .GetLastCatalogChangeAtAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new DateTimeOffset(2026, 9, 27, 12, 0, 0, TimeSpan.Zero));

        var sut = new GetStorefrontStatusHandler(_tenants, _catalog, _cache);
        await sut.Handle(new GetStorefrontStatusQuery(tenantId), CancellationToken.None);
        await sut.Handle(new GetStorefrontStatusQuery(tenantId), CancellationToken.None);

        await _catalog.Received(1)
            .GetLastCatalogChangeAtAsync(tenantId, Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Sin catálogo modificado la revisión es 0")]
    public async Task Handle_WithoutChanges_ReturnsZeroRevision()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);
        _catalog
            .GetLastCatalogChangeAtAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns((DateTimeOffset?)null);

        var sut = new GetStorefrontStatusHandler(_tenants, _catalog, _cache);
        var result = await sut.Handle(new GetStorefrontStatusQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Revision.Should().Be("0");
        result.Value.UpdatedAt.Should().BeNull();
    }

    [Fact(DisplayName = "Tienda sin módulo ecommerce responde no disponible")]
    public async Task Handle_WithoutEcommerceModule_FailsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(
                tenantId,
                "Tienda Demo",
                new ServicePlan("Small", 3, 1),
                moduleEntitlements: new List<ModuleEntitlement>
                {
                    ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Small),
                }).Value!);

        var sut = new GetStorefrontStatusHandler(_tenants, _catalog, _cache);
        var result = await sut.Handle(new GetStorefrontStatusQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
    }

    private void SetupTenant(Guid tenantId)
    {
        var tenant = Tenant.Create(
            tenantId,
            "Tienda Demo",
            new ServicePlan("Small", 3, 1),
            moduleEntitlements: new List<ModuleEntitlement>
            {
                ModuleEntitlement.FromTier(TenantModuleCodes.Ecommerce, ModuleTier.Small),
                ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Small),
            }).Value!;
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);
    }
}
