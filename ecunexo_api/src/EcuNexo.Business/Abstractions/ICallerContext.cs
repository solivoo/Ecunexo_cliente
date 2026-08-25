namespace EcuNexo.Business.Abstractions;

/// <summary>
/// Identidad del llamante hasta integrar JWT. Valores típicos vía cabeceras HTTP (ver host Api).
/// </summary>
public interface ICallerContext
{
    /// <summary>Usuario autenticado (p. ej. reclamación <c>sub</c> o cabecera de desarrollo).</summary>
    Guid? UserId { get; }

    /// <summary>
    /// Tenant explícito cuando la ruta no incluye <c>tenantId</c> (p. ej. <c>POST /permissions/.../policies</c>).
    /// </summary>
    Guid? ExplicitTenantId { get; }

    /// <summary>Titular de licencia sin tenant operativo (claim <c>pk=subscription</c>).</summary>
    bool IsSubscriptionHolder { get; }
}
