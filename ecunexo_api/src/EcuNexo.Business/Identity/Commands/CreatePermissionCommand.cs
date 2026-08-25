using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

/// <summary>
/// Alta de un permiso en el catálogo global.
/// </summary>
public sealed record CreatePermissionCommand(
    string Code,
    string? Description,
    string? DisplayName = null,
    string? Module = null,
    int SortOrder = 0) : ICommand<CreatePermissionResponse>;
