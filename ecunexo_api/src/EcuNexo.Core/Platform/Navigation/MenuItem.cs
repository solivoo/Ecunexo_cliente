namespace EcuNexo.Core.Platform.Navigation;

/// <summary>
/// Ítem de menú SPA (catálogo global platform, filtrado por permisos y módulos del tenant).
/// </summary>
public sealed class MenuItem
{
    public const int IdMaxLength = 120;
    public const int LabelMaxLength = 160;
    public const int IconMaxLength = 64;
    public const int RouteMaxLength = 256;
    public const int ModuleCodeMaxLength = 64;

    public string Id { get; set; } = string.Empty;

    public string? ParentId { get; set; }

    public string Label { get; set; } = string.Empty;

    public string? Icon { get; set; }

    /// <summary>Ruta relativa SPA sin slash inicial (ej. <c>equipo/usuarios</c>).</summary>
    public string? Route { get; set; }

    public int SortOrder { get; set; }

    public MenuContextKind Context { get; set; }

    public string ModuleCode { get; set; } = string.Empty;

    public MenuPositionKind Position { get; set; } = MenuPositionKind.Top;

    public string[] RequiredPermissions { get; set; } = [];

    public bool IsActive { get; set; } = true;

    public bool IsPlaceholder { get; set; }
}
