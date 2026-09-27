using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Commands.UnlikeStorefrontProduct;

public sealed record UnlikeStorefrontProductCommand(
    Guid TenantId,
    Guid ProductId,
    string? VisitorId) : ICommand<StorefrontProductLikeDto>;
