using EcuNexo.Core.Common;

namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Código de activación canjeable al crear el primer tenant (y usuario administrador) de una suscripción.
/// El valor que escribe el cliente nunca se persiste: solo <see cref="CodeHash"/>.
/// </summary>
public sealed class ActivationCode : AggregateRoot<Guid>
{
    public const int CodeHashMaxLength = 128;
    public const int PlanLabelMaxLength = 120;

    private ActivationCode()
    {
        CodeHash = string.Empty;
        PlanLabel = string.Empty;
        EnabledModuleCodes = [];
    }

    /// <summary>Huella SHA-256 hex (ver <see cref="ActivationCodeHasher"/>).</summary>
    public string CodeHash { get; private set; }

    /// <summary>Nombre del plan materializado en <see cref="ServicePlan.Name"/> del tenant.</summary>
    public string PlanLabel { get; private set; }

    /// <summary>Cuántas empresas (tenants) puede provisionar este código antes de agotarse.</summary>
    public int MaxTenants { get; private set; }

    public int MaxUsers { get; private set; }

    public int MaxWarehouses { get; private set; }

    /// <summary>Módulos de producto habilitados para tenants provisionados con este código.</summary>
    public List<string> EnabledModuleCodes { get; private set; }

    public DateTimeOffset ExpiresAtUtc { get; private set; }

    /// <summary>Slots de alta de tenant restantes. Al llegar a 0 el código queda agotado.</summary>
    public int ProvisioningSlotsRemaining { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public DateTimeOffset? ConsumedAtUtc { get; private set; }

    public Guid? ConsumedByTenantId { get; private set; }

    public static Result<ActivationCode> Create(
        Guid id,
        string codeHash,
        string planLabel,
        int maxTenants,
        int maxUsers,
        int maxWarehouses,
        IReadOnlyList<string> enabledModuleCodes,
        DateTimeOffset expiresAtUtc,
        DateTimeOffset utcNow)
    {
        if (string.IsNullOrWhiteSpace(codeHash) || codeHash.Length > CodeHashMaxLength)
        {
            return Result.Failure<ActivationCode>(
                new Error(
                    "activation.code_hash.invalid",
                    "La huella del código no es válida.",
                    ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(planLabel) || planLabel.Length > PlanLabelMaxLength)
        {
            return Result.Failure<ActivationCode>(
                new Error(
                    "activation.plan_label.invalid",
                    $"La etiqueta del plan no puede superar {PlanLabelMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        if (maxTenants < 1)
        {
            return Result.Failure<ActivationCode>(
                new Error("activation.max_tenants.invalid", "Debe permitirse al menos una empresa.", ErrorType.Validation));
        }

        if (maxUsers < 0 || maxWarehouses < 0)
        {
            return Result.Failure<ActivationCode>(
                new Error("activation.limits.invalid", "Los límites del plan no pueden ser negativos.", ErrorType.Validation));
        }

        if (enabledModuleCodes.Count == 0)
        {
            return Result.Failure<ActivationCode>(
                new Error(
                    "activation.modules.required",
                    "Debe indicarse al menos un módulo habilitado.",
                    ErrorType.Validation));
        }

        var modules = new List<string>(enabledModuleCodes.Count);
        foreach (var m in enabledModuleCodes)
        {
            var t = m.Trim();
            if (t.Length == 0 || !TenantModuleCodes.IsKnown(t))
            {
                return Result.Failure<ActivationCode>(
                    new Error(
                        "activation.module.unknown",
                        $"El módulo «{m}» no es reconocido.",
                        ErrorType.Validation));
            }

            if (!modules.Contains(t, StringComparer.OrdinalIgnoreCase))
            {
                modules.Add(t.ToLowerInvariant());
            }
        }

        if (expiresAtUtc <= utcNow)
        {
            return Result.Failure<ActivationCode>(
                new Error("activation.expires.invalid", "La fecha de expiración debe ser futura.", ErrorType.Validation));
        }

        return new ActivationCode
        {
            Id = id,
            CodeHash = codeHash.Trim(),
            PlanLabel = planLabel.Trim(),
            MaxTenants = maxTenants,
            MaxUsers = maxUsers,
            MaxWarehouses = maxWarehouses,
            EnabledModuleCodes = modules,
            ExpiresAtUtc = expiresAtUtc,
            ProvisioningSlotsRemaining = maxTenants,
            CreatedAtUtc = utcNow,
        };
    }

    /// <summary>Registra un tenant provisionado con este código. Agota el código cuando no quedan slots.</summary>
    public Result<Unit> RecordProvisioning(Guid tenantId, DateTimeOffset utcNow)
    {
        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Unit>(
                new Error("activation.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (ConsumedAtUtc is not null || ProvisioningSlotsRemaining <= 0)
        {
            return Result.Failure<Unit>(
                new Error("activation.exhausted", "Este código de activación ya fue usado o está agotado.", ErrorType.Conflict));
        }

        if (utcNow >= ExpiresAtUtc)
        {
            return Result.Failure<Unit>(
                new Error("activation.expired", "El código de activación ha expirado.", ErrorType.Validation));
        }

        ProvisioningSlotsRemaining--;
        if (ProvisioningSlotsRemaining == 0)
        {
            ConsumedAtUtc = utcNow;
            ConsumedByTenantId = tenantId;
        }

        return Unit.Value;
    }
}
