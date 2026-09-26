using EcuNexo.Business.Catalog;
using EcuNexo.Business.Storefront.Queries.ListStorefrontCategories;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class ListStorefrontCategoriesHandlerTests
{
    private readonly ICategoryRepository _categories = Substitute.For<ICategoryRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();

    [Fact(DisplayName = "Lista categorías activas ordenadas por nombre con su jerarquía")]
    public async Task Handle_ListsCategoriesOrderedByName()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);

        var rootId = Guid.CreateVersion7();
        _categories.ListActiveByTenantAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new List<Category>
            {
                Category.Create(Guid.CreateVersion7(), tenantId, "Zapatos").Value!,
                Category.Create(rootId, tenantId, "Ropa").Value!,
                Category.Create(Guid.CreateVersion7(), tenantId, "Calcetines", parentId: rootId).Value!,
            });

        var sut = new ListStorefrontCategoriesHandler(_categories, _tenants);
        var result = await sut.Handle(new ListStorefrontCategoriesQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var categories = result.Value!;
        categories.Select(c => c.Name).Should().Equal("Calcetines", "Ropa", "Zapatos");
        categories.Single(c => c.Name == "Calcetines").ParentId.Should().Be(rootId);
    }

    [Fact(DisplayName = "Tenant inexistente no expone categorías")]
    public async Task Handle_UnknownTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var sut = new ListStorefrontCategoriesHandler(_categories, _tenants);
        var result = await sut.Handle(new ListStorefrontCategoriesQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        await _categories.DidNotReceiveWithAnyArgs().ListActiveByTenantAsync(default, default);
    }
}
