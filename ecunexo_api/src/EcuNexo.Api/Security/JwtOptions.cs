namespace EcuNexo.Api.Security;

/// <summary>
/// Configuración JWT simétrica (HMAC). En producción usar variable de entorno <c>Jwt__SigningKey</c> o User Secrets, nunca un valor por defecto débil.
/// </summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    /// <summary>Clave secreta UTF-8; longitud recomendada ≥ 32 caracteres (256 bits efectivos para HS256).</summary>
    public string SigningKey { get; set; } = string.Empty;
}
