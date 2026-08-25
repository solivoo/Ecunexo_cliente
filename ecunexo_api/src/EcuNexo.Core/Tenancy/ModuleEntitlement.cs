using System.Text.Json.Serialization;

namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Define los límites y capacidades contratadas para un módulo de producto.
/// Reemplaza a la lista plana <c>enabled_modules</c> con una estructura jerárquica
/// que permite tiers (Small/Medium/Big/Enterprise) y límites transaccionales por módulo.
/// </summary>
public sealed record ModuleEntitlement
{
    /// <summary>Código de módulo de producto (ver <see cref="TenantModuleCodes"/>).</summary>
    public string ModuleCode { get; init; } = string.Empty;

    /// <summary>Nivel de servicio contratado para este módulo.</summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ModuleTier Tier { get; init; }

    /// <summary>
    /// Límites específicos del módulo (ej. max_warehouses, max_sku_count, max_invoices_per_month).
    /// Las claves disponibles dependen del módulo y del tier.
    /// <c>null</c> significa "usar los defaults del tier".
    /// </summary>
    public IReadOnlyDictionary<string, int>? Limits { get; init; }

    /// <summary>
    /// Resuelve un límite específico: primero busca en <see cref="Limits"/> (sobrescritos),
    /// luego en el catálogo de tiers. Retorna <c>null</c> si el límite no existe para este módulo.
    /// </summary>
    public int? GetLimit(string limitKey)
    {
        if (Limits is not null && Limits.TryGetValue(limitKey, out var value))
        {
            return value;
        }

        return ModuleTierCatalog.GetDefaultLimit(ModuleCode, Tier, limitKey);
    }

    /// <summary>
    /// Crea un entitlement usando exclusivamente los defaults del tier.
    /// </summary>
    public static ModuleEntitlement FromTier(string moduleCode, ModuleTier tier) =>
        new() { ModuleCode = moduleCode, Tier = tier };

    /// <summary>
    /// Crea un entitlement con límites sobrescritos sobre el tier base.
    /// </summary>
    public static ModuleEntitlement FromTierWithOverrides(
        string moduleCode,
        ModuleTier tier,
        IReadOnlyDictionary<string, int> limits) =>
        new() { ModuleCode = moduleCode, Tier = tier, Limits = limits };
}
