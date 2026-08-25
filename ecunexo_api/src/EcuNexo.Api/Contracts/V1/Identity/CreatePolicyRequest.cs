using EcuNexo.Business.Identity.Commands;
using EcuNexo.Core.Identity;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record CreatePolicyRequest(PolicyEffect Effect, string? Condition)
{
    public CreatePolicyCommand ToCommand(Guid permissionId) =>
        new(permissionId, Effect, Condition);
}
