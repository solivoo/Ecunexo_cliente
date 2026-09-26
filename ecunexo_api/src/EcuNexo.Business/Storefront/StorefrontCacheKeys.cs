namespace EcuNexo.Business.Storefront;

public static class StorefrontCacheKeys
{
    public static string ForHost(string host) => $"storefront:host:{host}";
}
