namespace EcuNexo.Business.Identity.PolicyEvaluation;

/// <summary>
/// Atributos disponibles en expresiones ABAC bajo el identificador <c>ctx</c> (registrado por <see cref="DynamicExpressoPolicyEvaluator"/>).
/// </summary>
public sealed record PolicyEvaluationContext(
    Guid? UserId,
    Guid? TenantId,
    Guid? ResourceId,
    DateTimeOffset UtcNow,
    string? UserDepartment = null,
    string? UserJobTitle = null,
    Guid? ResourceCreatedBy = null,
    string? ResourceDepartment = null)
{
    /// <summary>
    /// Contexto mínimo para comprobar sintaxis al crear una política; no debe usarse como decisión de acceso.
    /// </summary>
    public static PolicyEvaluationContext ForSyntaxCheck()
        => new(null, null, null, DateTimeOffset.UtcNow);
}
