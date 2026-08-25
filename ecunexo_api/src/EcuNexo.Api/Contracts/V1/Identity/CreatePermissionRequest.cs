using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record CreatePermissionRequest(
    string Code,
    string? Description,
    string? DisplayName = null,
    string? Module = null,
    int SortOrder = 0)
{
    public CreatePermissionCommand ToCommand() =>
        new(Code, Description, DisplayName, Module, SortOrder);
}
