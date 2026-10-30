namespace EcuNexo.Api.Configuration;

public sealed class LicenseValidationOptions
{
    public const string SectionName = "LicenseValidation";

    /// <summary>Pepper de validación (compartido con Ecunexo al emitir; no es el pepper de emisión).</summary>
    public string ValidationPepper { get; init; } = string.Empty;

    /// <summary>Clave pública RSA (PEM) para verificar el paquete firmado por platform.</summary>
    public string SigningPublicKeyPem { get; init; } = string.Empty;

    /// <summary>Ruta opcional al PEM público (desarrollo).</summary>
    public string? SigningPublicKeyPath { get; init; }

    /// <summary>URL del API platform para validación online periódica (opcional).</summary>
    public string? PlatformApiBaseUrl { get; init; }

    /// <summary>Clave opcional enviada en <c>X-Platform-Validation-Key</c>.</summary>
    public string? PlatformApiKey { get; init; }

    /// <summary>
    /// En ambiente de desarrollo (localhost), si es true omite la validación online remota periódica
    /// para permitir la operación offline y evitar bloqueos si el servicio externo de licencias no está levantado.
    /// Por defecto es true.
    /// </summary>
    public bool BypassInDevelopment { get; init; } = true;
}
