using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity.ApiKeys.Commands.CreateTenantApiKey;

public sealed record CreateTenantApiKeyCommand(
    Guid TenantId,
    string Name,
    IReadOnlyList<string> Scopes,
    DateTimeOffset? ExpiresAt) : ICommand<CreatedTenantApiKeyDto>;

public sealed class CreateTenantApiKeyHandler(
    ITenantRepository tenants,
    ITenantApiKeyRepository apiKeys,
    IModuleEntitlementGuard moduleGuard,
    ICallerContext caller,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork) : ICommandHandler<CreateTenantApiKeyCommand, CreatedTenantApiKeyDto>
{
    public async Task<Result<CreatedTenantApiKeyDto>> Handle(
        CreateTenantApiKeyCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty)
        {
            return Result.Failure<CreatedTenantApiKeyDto>(
                new Error("api_key.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        var tenant = await tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<CreatedTenantApiKeyDto>(
                new Error("tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        if (command.Scopes is null || command.Scopes.Count == 0)
        {
            return Result.Failure<CreatedTenantApiKeyDto>(
                new Error(
                    "api_key.scopes.required",
                    "Debe seleccionar al menos un permiso (scope) para la API Key.",
                    ErrorType.Validation));
        }

        var normalizedScopes = command.Scopes
            .Where(static s => !string.IsNullOrWhiteSpace(s))
            .Select(static s => s.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .OrderBy(static s => s, StringComparer.Ordinal)
            .ToList();

        foreach (var scope in normalizedScopes)
        {
            if (!DeveloperApiScopes.IsAllowed(scope))
            {
                return Result.Failure<CreatedTenantApiKeyDto>(
                    new Error(
                        "api_key.scope.not_allowed",
                        $"El permiso «{scope}» no está permitido para credenciales API Key externas.",
                        ErrorType.Validation));
            }

            var moduleCheck = await moduleGuard
                .RequireModuleForPermissionAsync(command.TenantId, scope, ct)
                .ConfigureAwait(false);
            if (moduleCheck.IsFailure && moduleCheck.Error is { } moduleError)
            {
                return Result.Failure<CreatedTenantApiKeyDto>(moduleError);
            }
        }

        var utcNow = DateTimeOffset.UtcNow;
        var (plainTextKey, keyPrefix, keyHash) = TenantApiKeyCrypto.GenerateKey();

        var createdResult = TenantApiKey.Create(
            idGenerator.NewId(),
            command.TenantId,
            command.Name,
            keyPrefix,
            keyHash,
            normalizedScopes,
            caller.UserId,
            command.ExpiresAt,
            utcNow);

        if (createdResult.IsFailure && createdResult.Error is { } createError)
        {
            return Result.Failure<CreatedTenantApiKeyDto>(createError);
        }

        var entity = createdResult.Value!;
        await apiKeys.AddAsync(entity, ct).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(
            new CreatedTenantApiKeyDto(
                entity.Id,
                entity.TenantId,
                entity.Name,
                entity.KeyPrefix,
                plainTextKey,
                entity.Scopes,
                entity.CreatedAt,
                entity.ExpiresAt));
    }
}
