using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands;

/// <summary>
/// Caso de uso: registrar un nuevo tenant con un plan de servicio inicial.
/// </summary>
/// <param name="Name">Nombre de la empresa (se valida también en el dominio).</param>
/// <param name="ServicePlanName">Nombre del plan (ver <see cref="EcuNexo.Core.Tenancy.ServicePlan"/>).</param>
/// <param name="MaxUsers">Límite de usuarios del plan.</param>
/// <param name="MaxWarehouses">Límite de bodegas del plan.</param>
/// <param name="TimeZoneId">Zona horaria IANA (opcional).</param>
/// <param name="Locale">Etiqueta BCP 47 (opcional).</param>
/// <param name="LogoUrl">URL del logo (opcional).</param>
/// <param name="PrimaryColorHex">Color de acento #RGB o #RRGGBB (opcional).</param>
public sealed record CreateTenantCommand(
    string Name,
    string ServicePlanName,
    int MaxUsers,
    int MaxWarehouses,
    string? TimeZoneId = null,
    string? Locale = null,
    string? LogoUrl = null,
    string? PrimaryColorHex = null) : ICommand<CreateTenantResponse>;
