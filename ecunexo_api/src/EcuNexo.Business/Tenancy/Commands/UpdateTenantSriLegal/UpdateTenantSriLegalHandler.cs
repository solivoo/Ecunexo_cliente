using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Commands.UpdateTenantSriLegal;

public sealed class UpdateTenantSriLegalHandler
    : ICommandHandler<UpdateTenantSriLegalCommand, UpdateTenantSriLegalResponse>
{
    public Task<Result<UpdateTenantSriLegalResponse>> Handle(
        UpdateTenantSriLegalCommand command,
        CancellationToken ct)
    {
        _ = command;
        _ = ct;
        return Task.FromResult(
            Result.Failure<UpdateTenantSriLegalResponse>(
                new Error(
                    "tenant.sri.identity.locked",
                    "La identidad legal solo la actualiza el titular en la ficha de la empresa.",
                    ErrorType.Forbidden)));
    }
}
