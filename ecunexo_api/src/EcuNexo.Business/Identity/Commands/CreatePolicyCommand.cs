using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity.Commands;

/// <summary>
/// Crea una política ABAC asociada a un permiso global.
/// </summary>
public sealed record CreatePolicyCommand(
    Guid PermissionId,
    PolicyEffect Effect,
    string? Condition) : ICommand<CreatePolicyResponse>;
