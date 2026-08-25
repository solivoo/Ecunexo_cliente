using EcuNexo.Business.Platform.Queries.GetSession;
using EcuNexo.Core.Platform.Navigation;

namespace EcuNexo.Business.Platform.Navigation;

public interface IMenuNavigationBuilder
{
    Task<MenuNavigationResult> BuildAsync(
        MenuContextKind context,
        IReadOnlyList<string> permissionCodes,
        IReadOnlyList<string>? enabledModuleCodes,
        CancellationToken cancellationToken = default);
}

public sealed record MenuNavigationResult(
    IReadOnlyList<NavigationNodeDto> Items,
    IReadOnlyList<string> AvailableContexts);

public sealed class MenuNavigationBuilder(
    IMenuItemRepository menuItems,
    EmbeddedNavigationBuilder embedded) : IMenuNavigationBuilder
{
    public async Task<MenuNavigationResult> BuildAsync(
        MenuContextKind context,
        IReadOnlyList<string> permissionCodes,
        IReadOnlyList<string>? enabledModuleCodes,
        CancellationToken cancellationToken = default)
    {
        var allItems = await menuItems.ListActiveAsync(context: null, cancellationToken).ConfigureAwait(false);

        if (allItems.Count == 0)
        {
            var legacy = embedded.Build(permissionCodes, enabledModuleCodes);
            return new MenuNavigationResult(legacy, ["operational"]);
        }

        var contextItems = allItems.Where(x => x.Context == context).ToList();
        var tree = MenuNavigationMapper.BuildTree(contextItems, permissionCodes, enabledModuleCodes);
        var contexts = MenuNavigationMapper.ListVisibleContexts(allItems, permissionCodes, enabledModuleCodes);

        return new MenuNavigationResult(tree, contexts);
    }
}
