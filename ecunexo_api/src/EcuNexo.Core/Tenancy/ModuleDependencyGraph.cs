namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Grafo de dependencias entre módulos de producto.
/// Define qué módulos son prerrequisito de otros al emitir licencias o crear planes.
/// </summary>
/// <remarks>
/// Jerarquía:
/// <code>
///   identity ── (siempre presente, no tiene dependencias)
///   catalog  ── (independiente: describe entidades — productos y servicios)
///       ├── warehousing ── (requiere catalog: contiene ubicaciones físicas para ítems)
///       │   └── inventory ── (requiere catalog + warehousing: stock en ubicaciones)
///       └── facturacion ── (requiere catalog: documentos de venta sobre ítems)
/// </code>
/// </remarks>
public static class ModuleDependencyGraph
{
    /// <summary>
    /// Para cada módulo, los códigos de módulos que DEBE tener habilitados.
    /// Si el módulo no está en el diccionario, no tiene dependencias.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> RequiredModules =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [TenantModuleCodes.Inventory] = [TenantModuleCodes.Catalog, TenantModuleCodes.Warehousing],
            [TenantModuleCodes.Warehousing] = [TenantModuleCodes.Catalog],
            [TenantModuleCodes.Invoicing] = [TenantModuleCodes.Catalog],
            [TenantModuleCodes.Repairs] = [TenantModuleCodes.Identity],
            [TenantModuleCodes.Customers] = [TenantModuleCodes.Identity],
        };

    /// <summary>
    /// Devuelve los módulos que deben estar habilitados para el módulo dado.
    /// Retorna lista vacía si el módulo no tiene dependencias.
    /// </summary>
    public static IReadOnlyList<string> GetRequiredModules(string moduleCode)
    {
        var normalized = moduleCode.Trim().ToLowerInvariant();
        return RequiredModules.TryGetValue(normalized, out var required)
            ? required
            : [];
    }

    /// <summary>
    /// Devuelve todos los módulos que dependen directa o transitivamente del módulo dado.
    /// Útil para saber qué se deshabilitaría al quitar un módulo.
    /// </summary>
    public static IReadOnlyList<string> GetDependants(string moduleCode)
    {
        var normalized = moduleCode.Trim().ToLowerInvariant();
        var dependants = new List<string>();

        foreach (var (dependent, required) in RequiredModules)
        {
            if (required.Any(r => string.Equals(r, normalized, StringComparison.OrdinalIgnoreCase)))
            {
                dependants.Add(dependent);
                // Transitividad
                dependants.AddRange(GetDependants(dependent));
            }
        }

        return dependants.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>
    /// Valida que los módulos seleccionados cumplan todas las dependencias.
    /// Retorna los errores encontrados.
    /// </summary>
    public static IReadOnlyList<string> Validate(IReadOnlyList<string> selectedModuleCodes)
    {
        var normalized = selectedModuleCodes
            .Select(c => c.Trim().ToLowerInvariant())
            .Where(c => c.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var errors = new List<string>();

        foreach (var code in normalized)
        {
            var required = GetRequiredModules(code);
            foreach (var req in required)
            {
                if (!normalized.Contains(req))
                {
                    var moduleLabel = GetModuleLabel(code);
                    var reqLabel = GetModuleLabel(req);
                    errors.Add($"El módulo «{moduleLabel}» requiere «{reqLabel}». Actívalo primero.");
                }
            }
        }

        return errors;
    }

    /// <summary>
    /// Valida la consistencia de tiers entre módulos dependientes.
    /// Un módulo no puede tener un tier mayor que sus dependencias.
    /// Ej: inventory Medium no puede existir con warehousing Small.
    /// Retorna los errores encontrados.
    /// </summary>
    public static IReadOnlyList<string> ValidateTierConsistency(
        IReadOnlyList<ModuleEntitlement> entitlements)
    {
        if (entitlements is null || entitlements.Count == 0)
        {
            return [];
        }

        var tierMap = entitlements.ToDictionary(
            e => e.ModuleCode.Trim().ToLowerInvariant(),
            e => e.Tier,
            StringComparer.OrdinalIgnoreCase);

        var errors = new List<string>();

        foreach (var (dependent, requiredList) in RequiredModules)
        {
            if (!tierMap.TryGetValue(dependent, out var dependentTier))
            {
                continue; // módulo no presente
            }

            foreach (var required in requiredList)
            {
                if (!tierMap.TryGetValue(required, out var requiredTier))
                {
                    continue; // dependencia no tiene tier explícito
                }

                if (dependentTier > requiredTier)
                {
                    var depLabel = GetModuleLabel(dependent);
                    var reqLabel = GetModuleLabel(required);
                    errors.Add(
                        $"El tier de «{depLabel}» ({TierLabel(dependentTier)}) no puede ser mayor " +
                        $"que el de «{reqLabel}» ({TierLabel(requiredTier)}). " +
                        $"Sube «{reqLabel}» o baja «{depLabel}».");
                }
            }
        }

        return errors;
    }

    private static string GetModuleLabel(string code) => code.ToLowerInvariant() switch
    {
        TenantModuleCodes.Identity => "Identidad",
        TenantModuleCodes.Catalog => "Catálogo",
        TenantModuleCodes.Warehousing => "Bodegas",
        TenantModuleCodes.Inventory => "Inventario",
        TenantModuleCodes.Invoicing => "Facturación",
        TenantModuleCodes.Accounting => "Contabilidad",
        TenantModuleCodes.Training => "Capacitación",
        TenantModuleCodes.Support => "Soporte",
        TenantModuleCodes.Repairs => "Taller y Reparaciones B2B",
        TenantModuleCodes.Customers => "Clientes y Directorio Comercial",
        _ => code,
    };

    private static string TierLabel(ModuleTier tier) => tier switch
    {
        ModuleTier.Small => "Sin tier",
        ModuleTier.Medium => "Básico",
        ModuleTier.Big => "Estándar",
        ModuleTier.Enterprise => "Avanzado",
        _ => tier.ToString(),
    };
}
