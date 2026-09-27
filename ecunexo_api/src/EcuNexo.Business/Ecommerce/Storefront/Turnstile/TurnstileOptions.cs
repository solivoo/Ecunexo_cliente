namespace EcuNexo.Business.Ecommerce.Storefront.Turnstile;

/// <summary>Configuración de Cloudflare Turnstile para el checkout público.</summary>
public sealed class TurnstileOptions
{
    public const string SectionName = "Turnstile";

    public const string DefaultVerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    public string SiteKey { get; set; } = string.Empty;

    public string SecretKey { get; set; } = string.Empty;

    public string VerifyUrl { get; set; } = DefaultVerifyUrl;

    /// <summary>Sin secret key el verificador queda deshabilitado (dev/local).</summary>
    public bool IsEnabled => !string.IsNullOrWhiteSpace(SecretKey);

    /// <summary>Site key expuesto a la vitrina; solo si Turnstile está habilitado.</summary>
    public string? ResolvedSiteKey =>
        IsEnabled && !string.IsNullOrWhiteSpace(SiteKey) ? SiteKey.Trim() : null;
}
