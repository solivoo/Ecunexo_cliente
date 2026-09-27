namespace EcuNexo.Business.Ecommerce.Storefront.Turnstile;

/// <summary>Resultado de validar un token de Cloudflare Turnstile.</summary>
public sealed record TurnstileVerificationResult(bool Success, IReadOnlyList<string> ErrorCodes)
{
    public static TurnstileVerificationResult Ok() => new(true, []);

    public static TurnstileVerificationResult Failed(params string[] errorCodes) =>
        new(false, errorCodes.Length == 0 ? ["verification-failed"] : errorCodes);
}

public interface ITurnstileVerifier
{
    /// <summary>Indica si hay secret key configurada; deshabilitado en dev/local.</summary>
    bool IsEnabled { get; }

    /// <summary>
    /// Verifica el token contra el endpoint <c>siteverify</c>. Un fallo de red se considera fracaso.
    /// </summary>
    Task<TurnstileVerificationResult> VerifyAsync(
        string? token,
        string? remoteIp,
        CancellationToken ct);
}
