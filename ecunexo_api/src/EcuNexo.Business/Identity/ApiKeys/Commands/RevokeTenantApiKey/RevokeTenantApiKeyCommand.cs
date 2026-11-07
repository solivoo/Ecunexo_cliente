using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.ApiKeys.Commands.RevokeTenantApiKey;

public sealed record RevokeTenantApiKeyCommand(
    Guid TenantId,
    Guid ApiKeyId) : ICommand<bool>;

public sealed class RevokeTenantApiKeyHandler(
    ITenantApiKeyRepository apiKeys,
    ICallerContext caller,
    IUnitOfWork unitOfWork) : ICommandHandler<RevokeTenantApiKeyCommand, bool>
{
    public async Task<Result<bool>> Handle(
        RevokeTenantApiKeyCommand command,
        CancellationToken ct)
    {
        var entity = await apiKeys
            .GetByIdForUpdateAsync(command.TenantId, command.ApiKeyId, ct)
            .ConfigureAwait(false);

        if (entity is null)
        {
            return Result.Failure<bool>(
                new Error("api_key.not_found", "La API Key no existe en esta organización.", ErrorType.NotFound));
        }

        var revokeResult = entity.Revoke(caller.UserId, DateTimeOffset.UtcNow);
        if (revokeResult.IsFailure && revokeResult.Error is { } revokeError)
        {
            return Result.Failure<bool>(revokeError);
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(true);
    }
}
