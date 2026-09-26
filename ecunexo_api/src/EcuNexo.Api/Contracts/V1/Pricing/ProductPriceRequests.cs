using EcuNexo.Business.Pricing;
using EcuNexo.Business.Pricing.Commands.CreateProductPrice;
using EcuNexo.Business.Pricing.Commands.UpdateProductPrice;
using EcuNexo.Business.Pricing.Queries.ResolvePrice;

namespace EcuNexo.Api.Contracts.V1.Pricing;

public sealed record PriceTierRequest(decimal QuantityFrom, decimal? QuantityTo, decimal UnitPrice);

public sealed record CreateProductPriceRequest(
    Guid PriceListId,
    Guid CatalogItemId,
    decimal Price,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Reason,
    IReadOnlyList<PriceTierRequest>? Tiers)
{
    public CreateProductPriceCommand ToCommand(Guid tenantId) =>
        new(
            tenantId,
            PriceListId,
            CatalogItemId,
            Price,
            ValidFrom,
            ValidTo,
            Reason,
            Tiers?.Select(t => new PriceTierInput(t.QuantityFrom, t.QuantityTo, t.UnitPrice)).ToList());
}

public sealed record UpdateProductPriceRequest(
    decimal Price,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Reason,
    bool? IsActive,
    IReadOnlyList<PriceTierRequest>? Tiers)
{
    public UpdateProductPriceCommand ToCommand(Guid tenantId, Guid productPriceId) =>
        new(
            tenantId,
            productPriceId,
            Price,
            ValidFrom,
            ValidTo,
            Reason,
            IsActive,
            Tiers?.Select(t => new PriceTierInput(t.QuantityFrom, t.QuantityTo, t.UnitPrice)).ToList());
}

public sealed record ResolvePriceRequest(
    Guid CatalogItemId,
    decimal Quantity,
    DateOnly Date,
    Guid? PriceListId)
{
    public ResolvePriceQuery ToQuery(Guid tenantId) =>
        new(tenantId, CatalogItemId, Quantity, Date, PriceListId);
}
