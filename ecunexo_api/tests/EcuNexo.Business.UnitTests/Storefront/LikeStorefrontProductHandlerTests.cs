using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Commands.LikeStorefrontProduct;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class LikeStorefrontProductHandlerTests
{
    private readonly IStorefrontCatalogRepository _catalog = Substitute.For<IStorefrontCatalogRepository>();
    private readonly IStorefrontProductLikeRepository _likes = Substitute.For<IStorefrontProductLikeRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly LikeStorefrontProductHandler _sut;

    public LikeStorefrontProductHandlerTests()
    {
        _sut = new LikeStorefrontProductHandler(
            _catalog,
            _likes,
            _tenants,
            _idGenerator,
            _unitOfWork);
    }

    [Fact(DisplayName = "Like idempotente: repetirlo no duplica y devuelve el conteo actual")]
    public async Task Handle_ExistingLike_DoesNotDuplicate()
    {
        var tenantId = Guid.CreateVersion7();
        var product = SetupTenantAndProduct(tenantId);

        _likes
            .ExistsAsync(tenantId, product.Id, "visitor-12345678", Arg.Any<CancellationToken>())
            .Returns(false, true);
        _likes
            .CountForItemAsync(tenantId, product.Id, Arg.Any<CancellationToken>())
            .Returns(1);

        var first = await _sut.Handle(
            new LikeStorefrontProductCommand(tenantId, product.Id, "visitor-12345678"),
            CancellationToken.None);
        var second = await _sut.Handle(
            new LikeStorefrontProductCommand(tenantId, product.Id, "visitor-12345678"),
            CancellationToken.None);

        first.IsSuccess.Should().BeTrue();
        first.Value!.Liked.Should().BeTrue();
        first.Value.LikeCount.Should().Be(1);
        second.IsSuccess.Should().BeTrue();
        second.Value!.Liked.Should().BeTrue();
        second.Value.LikeCount.Should().Be(1);

        await _likes.Received(1).AddAsync(
            Arg.Any<EcuNexo.Core.Ecommerce.StorefrontProductLike>(),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Visitor inválido responde ecommerce.like.visitor_invalid")]
    public async Task Handle_InvalidVisitor_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();

        var result = await _sut.Handle(
            new LikeStorefrontProductCommand(tenantId, Guid.CreateVersion7(), "corto"),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.like.visitor_invalid");
        result.Error.Type.Should().Be(ErrorType.Validation);
        await _catalog.DidNotReceiveWithAnyArgs().FindActiveRootAsync(default, default, default);
    }

    [Fact(DisplayName = "Variante o producto de otro tenant responde storefront.product.not_found")]
    public async Task Handle_NotAnActiveRoot_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);
        _catalog
            .FindActiveRootAsync(tenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((CatalogItem?)null);

        var result = await _sut.Handle(
            new LikeStorefrontProductCommand(tenantId, Guid.CreateVersion7(), "visitor-12345678"),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.product.not_found");
        result.Error.Type.Should().Be(ErrorType.NotFound);
        await _likes.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }

    [Fact(DisplayName = "Tenant inexistente no acepta likes")]
    public async Task Handle_UnknownTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var result = await _sut.Handle(
            new LikeStorefrontProductCommand(tenantId, Guid.CreateVersion7(), "visitor-12345678"),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        await _catalog.DidNotReceiveWithAnyArgs().FindActiveRootAsync(default, default, default);
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
        _idGenerator.NewId().Returns(Guid.CreateVersion7());
        return product;
    }

    private void SetupTenant(Guid tenantId)
    {
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
    }
}
