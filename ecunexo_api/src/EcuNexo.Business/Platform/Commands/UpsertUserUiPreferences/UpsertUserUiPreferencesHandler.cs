using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Settings;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Platform;
using FluentValidation;

namespace EcuNexo.Business.Platform.Commands.UpsertUserUiPreferences;

public sealed class UpsertUserUiPreferencesHandler
    : ICommandHandler<UpsertUserUiPreferencesCommand, UpsertUserUiPreferencesResponse>
{
    private readonly IValidator<UpsertUserUiPreferencesCommand> _validator;
    private readonly IIdGenerator _ids;
    private readonly ISysSettingRepository _settings;
    private readonly ITenantRepository _tenants;
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ISettingsResolver _resolver;
    private readonly IUnitOfWork _unitOfWork;

    public UpsertUserUiPreferencesHandler(
        IValidator<UpsertUserUiPreferencesCommand> validator,
        IIdGenerator ids,
        ISysSettingRepository settings,
        ITenantRepository tenants,
        ISubscriptionAccountRepository accounts,
        ISettingsResolver resolver,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _ids = ids;
        _settings = settings;
        _tenants = tenants;
        _accounts = accounts;
        _resolver = resolver;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpsertUserUiPreferencesResponse>> Handle(
        UpsertUserUiPreferencesCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpsertUserUiPreferencesResponse>(
                new Error("settings.ui.validation", message, ErrorType.Validation));
        }

        var userKey = command.ActorId.ToString("D");
        var rows = new (string Code, string Json)[]
        {
            (UiPreferenceCodes.MaxRecords, JsonSerializer.Serialize(command.MaxRecords)),
            (UiPreferenceCodes.Palette, JsonSerializer.Serialize(command.Palette)),
            (UiPreferenceCodes.Density, JsonSerializer.Serialize(command.Density)),
            (UiPreferenceCodes.StartDark, JsonSerializer.Serialize(command.StartDarkMode)),
            (UiPreferenceCodes.DefaultLookback, JsonSerializer.Serialize(command.DefaultLookback)),
        };

        foreach (var (code, json) in rows)
        {
            var upserted = await UpsertUserRowAsync(code, json, userKey, command.ActorId, ct)
                .ConfigureAwait(false);
            if (upserted.IsFailure)
            {
                return Result.Failure<UpsertUserUiPreferencesResponse>(upserted.Error!);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var resolved = await ResolveAsync(command, ct).ConfigureAwait(false);
        if (resolved.IsFailure)
        {
            return Result.Failure<UpsertUserUiPreferencesResponse>(resolved.Error!);
        }

        return Result.Success(new UpsertUserUiPreferencesResponse(resolved.Value!));
    }

    private async Task<Result> UpsertUserRowAsync(
        string code,
        string valueJson,
        string userKey,
        Guid actorId,
        CancellationToken ct)
    {
        var existing = await _settings
            .GetAsync(code, SettingScope.User, userKey, ct)
            .ConfigureAwait(false);
        if (existing is not null)
        {
            return existing.SetValue(valueJson, actorId);
        }

        var created = SysSetting.Create(_ids.NewId(), code, valueJson, SettingScope.User, userKey);
        if (created.IsFailure)
        {
            return Result.Failure(created.Error!);
        }

        await _settings.AddAsync(created.Value!, ct).ConfigureAwait(false);
        return Result.Success();
    }

    private async Task<Result<IReadOnlyDictionary<string, JsonElement>>> ResolveAsync(
        UpsertUserUiPreferencesCommand command,
        CancellationToken ct)
    {
        if (command.IsSubscriptionHolder)
        {
            var account = await _accounts.GetByIdAsync(command.ActorId, ct).ConfigureAwait(false);
            if (account is null)
            {
                return Result.Failure<IReadOnlyDictionary<string, JsonElement>>(
                    new Error("settings.subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
            }

            var merged = await _resolver
                .ResolveAsync(Guid.Empty, command.ActorId, account.ServicePlan.Name, ct)
                .ConfigureAwait(false);
            return Result.Success(merged);
        }

        if (command.TenantId is not { } tenantId)
        {
            return Result.Failure<IReadOnlyDictionary<string, JsonElement>>(
                new Error("auth.tenant.required", "Se requiere tenant para guardar preferencias.", ErrorType.Validation));
        }

        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<IReadOnlyDictionary<string, JsonElement>>(
                new Error("settings.tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        var settings = await _resolver
            .ResolveAsync(tenantId, command.ActorId, tenant.ServicePlan.Name, ct)
            .ConfigureAwait(false);
        return Result.Success(settings);
    }
}
