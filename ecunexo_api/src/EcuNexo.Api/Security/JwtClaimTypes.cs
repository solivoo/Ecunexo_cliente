namespace EcuNexo.Api.Security;

/// <summary>Claims personalizados emitidos por esta API (además de <c>sub</c> estándar).</summary>
public static class JwtClaimTypes
{
    /// <summary>Tenant opcional del sujeto (GUID en formato <c>D</c>).</summary>
    public const string TenantId = "tid";

    /// <summary><c>subscription</c> = titular de licencia sin tenant operativo.</summary>
    public const string PrincipalKind = "pk";

    public const string SubscriptionPrincipal = "subscription";

    public const string ApiKeyPrincipal = "api_key";

    public const string ApiKeyId = "akid";

    public const string ApiKeyScope = "scope";
}
