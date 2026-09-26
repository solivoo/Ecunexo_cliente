using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing;

/// <summary>Solicitud de resolución de precio. Los campos de fase 2 quedan reservados.</summary>
public sealed record PricingRequest(
    Guid CatalogItemId,
    decimal Quantity,
    DateOnly Date,
    Guid? PriceListId = null,
    Guid? CustomerId = null,
    Guid? BranchId = null,
    Guid? WarehouseId = null,
    string? Channel = null);

/// <summary>Desglose completo del precio resuelto; los consumidores solo lo persisten o pintan.</summary>
public sealed record PricingResult(
    Guid CatalogItemId,
    Guid PriceListId,
    string PriceListCode,
    decimal ListPrice,
    decimal UnitPrice,
    decimal? TierPrice,
    string? TierLabel,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal NetPrice,
    decimal TaxableBase,
    decimal TaxAmount,
    decimal FinalPrice,
    decimal TaxRate,
    bool PricesIncludeTax,
    string Currency,
    IReadOnlyList<string> AppliedRules);

/// <summary>Única fuente de verdad del precio comercial de EcuNexo.</summary>
public interface IPricingService
{
    Task<Result<PricingResult>> ResolveAsync(Guid tenantId, PricingRequest request, CancellationToken ct);
}
