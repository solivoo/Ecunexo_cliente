using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Platform;

public sealed class SysSetting : AggregateRoot<Guid>, IAuditable
{
    public const int CodeMaxLength = 120;
    public const int ScopeIdMaxLength = 120;

    private SysSetting()
    {
        Code = string.Empty;
        ValueJson = "{}";
    }

    public string Code { get; private set; }

    public string ValueJson { get; private set; }

    public SettingScope Scope { get; private set; }

    /// <summary>Identificador del scope (plan name, tenant id, user id); null para global.</summary>
    public string? ScopeId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<SysSetting> Create(
        Guid id,
        string code,
        string valueJson,
        SettingScope scope,
        string? scopeId)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length > CodeMaxLength)
        {
            return Result.Failure<SysSetting>(
                new Error("setting.code.invalid", "El código de configuración no es válido.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(valueJson))
        {
            return Result.Failure<SysSetting>(
                new Error("setting.value.required", "El valor JSON es obligatorio.", ErrorType.Validation));
        }

        var normalizedScopeId = NormalizeScopeId(scope, scopeId);
        if (normalizedScopeId.IsFailure)
        {
            return Result.Failure<SysSetting>(normalizedScopeId.Error!);
        }

        return new SysSetting
        {
            Id = id,
            Code = code.Trim().ToLowerInvariant(),
            ValueJson = valueJson,
            Scope = scope,
            ScopeId = normalizedScopeId.Value,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public Result SetValue(string valueJson, Guid? updatedBy)
    {
        if (string.IsNullOrWhiteSpace(valueJson))
        {
            return Result.Failure(
                new Error("setting.value.required", "El valor JSON es obligatorio.", ErrorType.Validation));
        }

        ValueJson = valueJson;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    private static Result<string?> NormalizeScopeId(SettingScope scope, string? scopeId)
    {
        return scope switch
        {
            SettingScope.Global when string.IsNullOrWhiteSpace(scopeId) => Result.Success<string?>(null),
            SettingScope.Global => Result.Failure<string?>(
                new Error("setting.scope_id.invalid", "Global no admite scopeId.", ErrorType.Validation)),
            SettingScope.Plan or SettingScope.Tenant or SettingScope.User when string.IsNullOrWhiteSpace(scopeId) =>
                Result.Failure<string?>(
                    new Error("setting.scope_id.required", "scopeId es obligatorio para este nivel.", ErrorType.Validation)),
            SettingScope.Plan or SettingScope.Tenant or SettingScope.User => Result.Success<string?>(scopeId!.Trim()),
            _ => Result.Failure<string?>(
                new Error("setting.scope.invalid", "Scope no reconocido.", ErrorType.Validation)),
        };
    }
}
