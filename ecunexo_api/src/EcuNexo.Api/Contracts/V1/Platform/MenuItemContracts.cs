namespace EcuNexo.Api.Contracts.V1.Platform;

public sealed record MenuItemRequest(
    string Id,
    string? ParentId,
    string Label,
    string? Icon,
    string? Route,
    int SortOrder,
    string Context,
    string ModuleCode,
    string Position,
    string[] RequiredPermissions,
    bool IsActive,
    bool IsPlaceholder = false);

public sealed record MenuItemResponse(
    string Id,
    string? ParentId,
    string Label,
    string? Icon,
    string? Route,
    int SortOrder,
    string Context,
    string ModuleCode,
    string Position,
    string[] RequiredPermissions,
    bool IsActive,
    bool IsPlaceholder)
{
    public static MenuItemResponse FromEntity(EcuNexo.Core.Platform.Navigation.MenuItem item) =>
        new(
            item.Id,
            item.ParentId,
            item.Label,
            item.Icon,
            item.Route,
            item.SortOrder,
            item.Context.ToString().ToLowerInvariant(),
            item.ModuleCode,
            item.Position.ToString().ToLowerInvariant(),
            item.RequiredPermissions,
            item.IsActive,
            item.IsPlaceholder);
}
