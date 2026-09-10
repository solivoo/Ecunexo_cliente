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
