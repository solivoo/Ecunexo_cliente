using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Commands.LikeStorefrontProduct;

public sealed record LikeStorefrontProductCommand(
    Guid TenantId,
    Guid ProductId,
    string? VisitorId) : ICommand<StorefrontProductLikeDto>;
