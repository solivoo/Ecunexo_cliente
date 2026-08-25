namespace EcuNexo.Business.Platform.Navigation;

public sealed record NavigationCatalogItem(
    string Id,
    string Label,
    string? Route,
    string? Icon,
    string? RequiredPermission,
    string? RequiredModule,
    int Order,
    bool Placeholder,
    List<NavigationCatalogItem>? Children);
