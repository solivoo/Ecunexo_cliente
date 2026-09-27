using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Commands.UnlikeStorefrontProduct;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class UnlikeStorefrontProductHandlerTests
{
    private readonly IStorefrontCatalogRepository _catalog = Substitute.For<IStorefrontCatalogRepository>();
    private readonly IStorefrontProductLikeRepository _likes = Substitute.For<IStorefrontProductLikeRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly UnlikeStorefrontProductHandler _sut;

    public UnlikeStorefrontProductHandlerTests()
    {
        _sut = new UnlikeStorefrontProductHandler(_catalog, _likes, _tenants, _unitOfWork);
    }

    [Fact(DisplayName = "Unlike idempotente: quitarlo dos veces no falla y devuelve el conteo")]
    public async Task Handle_RemovesLikeOnceAndIsIdempotent()
    {
        var tenantId = Guid.CreateVersion7();
        var product = SetupTenantAndProduct(tenantId);

        _likes
            .RemoveAsync(tenantId, product.Id, "visitor-12345678", Arg.Any<CancellationToken>())
            .Returns(true, false);
        _likes
            .CountForItemAsync(tenantId, product.Id, Arg.Any<CancellationToken>())
            .Returns(0);

        var first = await _sut.Handle(
            new UnlikeStorefrontProductCommand(tenantId, product.Id, "visitor-12345678"),
            CancellationToken.None);
        var second = await _sut.Handle(
            new UnlikeStorefrontProductCommand(tenantId, product.Id, "visitor-12345678"),
            CancellationToken.None);

        first.IsSuccess.Should().BeTrue();
        first.Value!.Liked.Should().BeFalse();
        first.Value.LikeCount.Should().Be(0);
        second.IsSuccess.Should().BeTrue();
        second.Value!.Liked.Should().BeFalse();

        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Visitor inválido no quita likes")]
    public async Task Handle_InvalidVisitor_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();

        var result = await _sut.Handle(
            new UnlikeStorefrontProductCommand(tenantId, Guid.CreateVersion7(), null),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.like.visitor_invalid");
        await _likes.DidNotReceiveWithAnyArgs().RemoveAsync(default, default, default!, default);
    }

    [Fact(DisplayName = "Producto que no es raíz activa del tenant responde no disponible")]
    public async Task Handle_NotAnActiveRoot_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);
        _catalog
            .FindActiveRootAsync(tenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((CatalogItem?)null);

        var result = await _sut.Handle(
            new UnlikeStorefrontProductCommand(tenantId, Guid.CreateVersion7(), "visitor-12345678"),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.product.not_found");
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    private CatalogItem SetupTenantAndProduct(Guid tenantId)
    {
        SetupTenant(tenantId);

        var product = CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Runner",
            null,
            "CALC-01",
            3.5m,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _catalog
            .FindActiveRootAsync(tenantId, product.Id, Arg.Any<CancellationToken>())
            .Returns(product);
        return product;
    }

    private void SetupTenant(Guid tenantId)
    {
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
    }
}
