namespace EcuNexo.Business.Logistics;

public sealed record ShippingZoneDto(
    Guid Id,
    Guid TenantId,
    string Code,
    string Name,
    string? Description,
    string? Provinces,
    int SortOrder,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

public sealed record CreateShippingZoneInput(
    string Code,
    string Name,
    string? Description = null,
    string? Provinces = null,
    int SortOrder = 0);

public sealed record UpdateShippingZoneInput(
    string Code,
    string Name,
    string? Description = null,
    string? Provinces = null,
    int SortOrder = 0,
    bool IsActive = true);

public sealed record ShippingMethodDto(
    Guid Id,
    Guid TenantId,
    string Code,
    string Name,
    string? Description,
    string? EstimatedDays,
    int SortOrder,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

public sealed record CreateShippingMethodInput(
    string Code,
    string Name,
    string? Description = null,
    string? EstimatedDays = null,
    int SortOrder = 0);

public sealed record UpdateShippingMethodInput(
    string Code,
    string Name,
    string? Description = null,
    string? EstimatedDays = null,
    int SortOrder = 0,
    bool IsActive = true);
