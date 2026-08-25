using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Licensing;

namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Titular de licencia (sin tenant). Provisiona empresas bajo <see cref="SubscriptionGroupId"/>.
/// </summary>
public sealed class SubscriptionAccount : AggregateRoot<Guid>, IAuditable
{
    public const int NameMaxLength = User.NameMaxLength;
    public const int DepartmentMaxLength = User.DepartmentMaxLength;
    public const int PhoneMaxLength = User.PhoneMaxLength;
    public const int JobTitleMaxLength = User.JobTitleMaxLength;
    public const int PasswordHashMaxLength = User.PasswordHashMaxLength;

    private SubscriptionAccount()
    {
        Email = null!;
        Name = string.Empty;
    }

    /// <summary>Grant emitido por platform (<c>license_grants.id</c>).</summary>
    public Guid GrantId { get; private set; }

    public string Email { get; private set; }

    public string Name { get; private set; }

    public string? Department { get; private set; }

    public string? Phone { get; private set; }

    public string? JobTitle { get; private set; }

    public string PasswordHash { get; private set; } = string.Empty;

    public ServicePlan ServicePlan { get; private set; } = null!;

    public int SubscriptionMaxTenants { get; private set; }

    public List<string>? EnabledModuleCodes { get; private set; }

    /// <summary>
    /// Derechos de uso por módulo con tiers y límites transaccionales.
    /// Reemplaza a <see cref="EnabledModuleCodes"/> para toda validación nueva.
    /// </summary>
    public IReadOnlyList<ModuleEntitlement>? ModuleEntitlements { get; private set; }

    /// <summary>
    /// Agrupa empresas provisionadas bajo esta licencia.</summary>
    public Guid SubscriptionGroupId { get; private set; }

    public DateTimeOffset LicenseExpiresAtUtc { get; private set; }

    public int OnlineValidationIntervalDays { get; private set; } = LicenseValidationPolicy.DefaultIntervalDays;

    public DateTimeOffset? LastOnlineLicenseValidationAtUtc { get; private set; }

    public DateTimeOffset? LastLoginAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<SubscriptionAccount> Create(
        Guid id,
        Guid grantId,
        Email email,
        string name,
        string passwordHash,
        ServicePlan servicePlan,
        int subscriptionMaxTenants,
        IReadOnlyList<string>? enabledModuleCodes,
        IReadOnlyList<ModuleEntitlement>? moduleEntitlements,
        DateTimeOffset licenseExpiresAtUtc,
        int onlineValidationIntervalDays,
        DateTimeOffset? lastOnlineLicenseValidationAtUtc,
        string? department = null,
        string? phone = null,
        string? jobTitle = null)
    {
        ArgumentNullException.ThrowIfNull(email);
        ArgumentNullException.ThrowIfNull(servicePlan);

        if (grantId == Guid.Empty || id == Guid.Empty)
        {
            return Result.Failure<SubscriptionAccount>(
                new Error("subscription.ids.invalid", "Identificadores inválidos.", ErrorType.Validation));
        }

        if (subscriptionMaxTenants < 1)
        {
            return Result.Failure<SubscriptionAccount>(
                new Error(
                    "subscription.max_tenants.invalid",
                    "El cupo de empresas debe ser al menos 1.",
                    ErrorType.Validation));
        }

        if (licenseExpiresAtUtc <= DateTimeOffset.UtcNow)
        {
            return Result.Failure<SubscriptionAccount>(
                new Error("subscription.license.expired", "La licencia ya expiró.", ErrorType.Validation));
        }

        onlineValidationIntervalDays = LicenseValidationPolicy.NormalizeIntervalDays(onlineValidationIntervalDays);

        if (string.IsNullOrWhiteSpace(passwordHash) || passwordHash.Length > PasswordHashMaxLength)
        {
            return Result.Failure<SubscriptionAccount>(
                new Error("subscription.password.invalid", "Contraseña inválida.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<SubscriptionAccount>(
                new Error("subscription.name.required", "El nombre es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure<SubscriptionAccount>(
                new Error(
                    "subscription.name.length",
                    $"El nombre no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        List<string>? modules = null;
        if (enabledModuleCodes is not null)
        {
            if (enabledModuleCodes.Count == 0)
            {
                return Result.Failure<SubscriptionAccount>(
                    new Error(
                        "subscription.enabled_modules.empty",
                        "Si se indican módulos, debe existir al menos uno.",
                        ErrorType.Validation));
            }

            modules = [];
            foreach (var m in enabledModuleCodes)
            {
                var t = m.Trim();
                if (t.Length == 0 || !TenantModuleCodes.IsKnown(t))
                {
                    return Result.Failure<SubscriptionAccount>(
                        new Error(
                            "subscription.enabled_modules.unknown",
                            $"El módulo «{m}» no es reconocido.",
                            ErrorType.Validation));
                }

                if (!modules.Contains(t, StringComparer.OrdinalIgnoreCase))
                {
                    modules.Add(t.ToLowerInvariant());
                }
            }
        }

        // Validar moduleEntitlements (nuevo modelo de tiers)
        IReadOnlyList<ModuleEntitlement>? entitlements = null;
        if (moduleEntitlements is not null)
        {
            if (moduleEntitlements.Count == 0)
            {
                return Result.Failure<SubscriptionAccount>(
                    new Error(
                        "subscription.module_entitlements.empty",
                        "Si se indican entitlements, debe existir al menos uno.",
                        ErrorType.Validation));
            }

            var deduped = new List<ModuleEntitlement>(moduleEntitlements.Count);
            foreach (var e in moduleEntitlements)
            {
                if (!TenantModuleCodes.IsKnown(e.ModuleCode))
                {
                    return Result.Failure<SubscriptionAccount>(
                        new Error(
                            "subscription.module_entitlements.unknown",
                            $"El módulo «{e.ModuleCode}» no es reconocido.",
                            ErrorType.Validation));
                }

                if (deduped.Any(d => string.Equals(d.ModuleCode, e.ModuleCode, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                deduped.Add(e);
            }

            entitlements = deduped;
        }

        return new SubscriptionAccount
        {
            Id = id,
            GrantId = grantId,
            Email = email.Value,
            Name = trimmedName,
            Department = NormalizeOptional(department, DepartmentMaxLength),
            Phone = NormalizeOptional(phone, PhoneMaxLength),
            JobTitle = NormalizeOptional(jobTitle, JobTitleMaxLength),
            PasswordHash = passwordHash,
            ServicePlan = servicePlan,
            SubscriptionMaxTenants = subscriptionMaxTenants,
            EnabledModuleCodes = modules,
            ModuleEntitlements = entitlements,
            SubscriptionGroupId = id,
            LicenseExpiresAtUtc = licenseExpiresAtUtc,
            OnlineValidationIntervalDays = onlineValidationIntervalDays,
            LastOnlineLicenseValidationAtUtc = lastOnlineLicenseValidationAtUtc,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public bool IsLicenseExpired(DateTimeOffset utcNow) => utcNow >= LicenseExpiresAtUtc;

    public bool IsOnlineValidationDue(DateTimeOffset utcNow)
    {
        var anchor = LastOnlineLicenseValidationAtUtc ?? CreatedAt;
        return utcNow >= anchor.AddDays(OnlineValidationIntervalDays);
    }

    public Result<Unit> ReplaceLicenseGrant(
        Guid newGrantId,
        ServicePlan servicePlan,
        int subscriptionMaxTenants,
        IReadOnlyList<string>? enabledModuleCodes,
        IReadOnlyList<ModuleEntitlement>? moduleEntitlements,
        DateTimeOffset licenseExpiresAtUtc,
        int onlineValidationIntervalDays,
        DateTimeOffset utcNow)
    {
        if (newGrantId == Guid.Empty)
        {
            return Result.Failure<Unit>(
                new Error("subscription.grant.invalid", "Grant inválido.", ErrorType.Validation));
        }

        if (licenseExpiresAtUtc <= utcNow)
        {
            return Result.Failure<Unit>(
                new Error("subscription.license.expired", "La licencia ya expiró.", ErrorType.Validation));
        }

        GrantId = newGrantId;
        ServicePlan = servicePlan;
        SubscriptionMaxTenants = subscriptionMaxTenants;
        OnlineValidationIntervalDays = LicenseValidationPolicy.NormalizeIntervalDays(onlineValidationIntervalDays);
        LicenseExpiresAtUtc = licenseExpiresAtUtc;
        LastOnlineLicenseValidationAtUtc = utcNow;
        UpdatedAt = utcNow;

        if (enabledModuleCodes is null)
        {
            EnabledModuleCodes = null;
        }
        else
        {
            var modules = new List<string>();
            foreach (var module in enabledModuleCodes)
            {
                var normalized = module.Trim().ToLowerInvariant();
                if (normalized.Length == 0 || !TenantModuleCodes.IsKnown(normalized))
                {
                    return Result.Failure<Unit>(
                        new Error("subscription.enabled_modules.unknown", $"Módulo «{module}» no reconocido.", ErrorType.Validation));
                }

                if (!modules.Contains(normalized, StringComparer.Ordinal))
                {
                    modules.Add(normalized);
                }
            }

            EnabledModuleCodes = modules;
        }

        ModuleEntitlements = moduleEntitlements;
        return Unit.Value;
    }

    public void RecordOnlineValidation(DateTimeOffset utcNow)
    {
        LastOnlineLicenseValidationAtUtc = utcNow;
        UpdatedAt = utcNow;
    }

    public void TouchLastLogin(DateTimeOffset utcNow)
    {
        LastLoginAt = utcNow;
        UpdatedAt = utcNow;
    }

    private static string? NormalizeOptional(string? value, int maxLength)
    {
        if (value is null)
        {
            return null;
        }

        var t = value.Trim();
        if (t.Length == 0)
        {
            return null;
        }

        return t.Length > maxLength ? t[..maxLength] : t;
    }
}
