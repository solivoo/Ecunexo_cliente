using EcuNexo.Core.Customers;

namespace EcuNexo.Api.Contracts.V1.Customers;

public sealed record CustomerDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string? TaxId,
    CustomerType CustomerType,
    CustomerIdentificationType IdentificationType,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    string? ContactPerson,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

public sealed record CreateCustomerApiRequest(
    string Name,
    string? TaxId = null,
    CustomerType CustomerType = CustomerType.CorporativoB2B,
    CustomerIdentificationType IdentificationType = CustomerIdentificationType.Ruc,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null,
    string? ContactPerson = null,
    string? Notes = null);

public sealed record UpdateCustomerApiRequest(
    string Name,
    string? TaxId = null,
    CustomerType? CustomerType = null,
    CustomerIdentificationType? IdentificationType = null,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null,
    string? ContactPerson = null,
    string? Notes = null,
    bool? IsActive = null);

public sealed record ToggleCustomerStatusApiRequest(bool IsActive);

public sealed record CustomerTypeDefinitionDto(
    Guid Id,
    int Code,
    string Name,
    string ShortLabel,
    string Tone,
    int SortOrder,
    bool IsSystem,
    bool IsActive);

public sealed record CreateCustomerTypeApiRequest(
    string Name,
    string ShortLabel,
    string? Tone = null,
    int? SortOrder = null);

public sealed record UpdateCustomerTypeApiRequest(
    string Name,
    string ShortLabel,
    string? Tone = null,
    int? SortOrder = null,
    bool? IsActive = null);

public sealed record CustomerRepairRateCardDto(
    Guid Id,
    Guid CustomerId,
    decimal? RateN1,
    decimal? RateN2,
    decimal? RateN3,
    string? ContractReference,
    DateTimeOffset? ValidFrom,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

public sealed record UpsertCustomerRepairRateCardRequest(
    decimal? RateN1 = null,
    decimal? RateN2 = null,
    decimal? RateN3 = null,
    string? ContractReference = null,
    DateTimeOffset? ValidFrom = null);
