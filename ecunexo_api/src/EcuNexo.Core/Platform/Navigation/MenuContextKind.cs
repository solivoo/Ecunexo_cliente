namespace EcuNexo.Core.Platform.Navigation;

public enum MenuContextKind
{
    Operational = 0,
    Configuration = 1,

    /// <summary>Menú del titular de licencia (sin tenant operativo).</summary>
    Subscription = 2,
}
