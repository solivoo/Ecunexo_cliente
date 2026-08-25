using EcuNexo.Business.Platform.Queries.GetSession;

namespace EcuNexo.Business.Platform.Navigation;

public interface INavigationBuilder
{
    IReadOnlyList<NavigationNodeDto> Build(
        IReadOnlyList<string> permissionCodes,
        IReadOnlyList<string>? enabledModuleCodes);
}
