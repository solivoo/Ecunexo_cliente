using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands.ProvisionSubscriptionCompany;

public sealed record ProvisionSubscriptionCompanyCommand(
    Guid SubscriptionAccountId,
    string TenantName,
    string OwnerEmail,
    string OwnerName,
    string OwnerPassword,
    string? TimeZoneId = null,
    string? Locale = null,
    string? LogoUrl = null,
    string? PrimaryColorHex = null,
    string? OwnerDepartment = null,
    string? OwnerPhone = null,
    string? OwnerJobTitle = null) : ICommand<ProvisionSubscriptionCompanyResponse>;
