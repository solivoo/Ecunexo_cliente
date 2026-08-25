using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands;

/// <summary>
/// Alta inicial: canjea un código de activación, crea tenant con entitlements, rol administrador,
/// permisos activos del catálogo y el primer usuario.
/// </summary>
public sealed record OnboardTenantWithActivationCommand(
    string ActivationCode,
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
    string? OwnerJobTitle = null) : ICommand<OnboardTenantWithActivationResponse>;
