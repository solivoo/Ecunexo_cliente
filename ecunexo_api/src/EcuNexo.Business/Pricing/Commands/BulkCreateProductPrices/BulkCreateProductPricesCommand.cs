using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Commands.BulkCreateProductPrices;

public sealed record BulkPriceItemInput(
    Guid CatalogItemId,
    decimal Price,
    IReadOnlyList<PriceTierInput>? Tiers = null);

public sealed record BulkCreateProductPricesCommand(
    Guid TenantId,
    Guid PriceListId,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Reason,
    IReadOnlyList<BulkPriceItemInput> Items) : ICommand<BulkCreateProductPricesResponse>;

public sealed record BulkCreateProductPricesResponse(Guid PriceListId, int CreatedCount);
