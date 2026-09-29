namespace EcuNexo.Business.Logistics;

public sealed record ShippingRateRuleDto(
    Guid Id,
    Guid TenantId,
    string Carrier,
    string Zone,
    string Name,
    decimal MinQuantity,
    decimal? MaxQuantity,
    decimal? MinOrderAmount,
    decimal Price,
    decimal TaxRate,
    string? EstimatedDays,
    string? Notes,
    int SortOrder,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

public sealed record CreateShippingRateRuleInput(
    string Carrier,
    string Zone,
    string Name,
    decimal Price,
    decimal MinQuantity = 1m,
    decimal? MaxQuantity = null,
    decimal? MinOrderAmount = null,
    decimal TaxRate = 15m,
    string? EstimatedDays = null,
    string? Notes = null,
    int SortOrder = 0);

public sealed record UpdateShippingRateRuleInput(
    string Carrier,
    string Zone,
    string Name,
    decimal Price,
    decimal MinQuantity = 1m,
    decimal? MaxQuantity = null,
    decimal? MinOrderAmount = null,
    decimal TaxRate = 15m,
    string? EstimatedDays = null,
    string? Notes = null,
    int SortOrder = 0,
    bool IsActive = true);

public sealed record ResolveShippingRatesInput(
    string? Zone,
    decimal TotalQuantity,
    decimal TotalOrderAmount = 0m);

public sealed record ResolvedShippingOptionDto(
    Guid RuleId,
    string Carrier,
    string Zone,
    string Name,
    decimal BasePrice,
    decimal TaxRate,
    decimal TaxAmount,
    decimal TotalPrice,
    string? EstimatedDays,
    string? Notes,
    bool IsEligible,
    decimal? UnitsNeeded,
    bool IsRecommended);
