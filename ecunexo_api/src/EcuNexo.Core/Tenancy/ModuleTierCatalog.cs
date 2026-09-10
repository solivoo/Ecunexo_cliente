namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Catálogo de límites predefinidos por módulo y tier.
/// Usado por <see cref="ModuleEntitlement.GetLimit"/> cuando no hay sobrescritos.
/// 
/// Límites transaccionales (ej. max_invoices_per_month) se resetean
/// el día 1 de cada mes calendario y aplican por empresa (tenant).
/// Al excederse, la operación se bloquea con error 403.
/// </summary>
public static class ModuleTierCatalog
{
    // ──────────────────────────────────────────────
    // Inventory
    // ──────────────────────────────────────────────
    public const string LimitMaxSkuCount = "max_sku_count";
    public const string LimitMaxVariantsPerItem = "max_variants_per_item";
    public const string LimitMaxCategories = "max_categories";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> InventoryLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxSkuCount] = 100,
            [LimitMaxVariantsPerItem] = 5,
            [LimitMaxCategories] = 10,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxSkuCount] = 500,
            [LimitMaxVariantsPerItem] = 10,
            [LimitMaxCategories] = 20,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxSkuCount] = 2_000,
            [LimitMaxVariantsPerItem] = 25,
            [LimitMaxCategories] = 50,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxSkuCount] = int.MaxValue,
            [LimitMaxVariantsPerItem] = int.MaxValue,
            [LimitMaxCategories] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // Warehousing
    // ──────────────────────────────────────────────
    public const string LimitMaxWarehouses = "max_warehouses";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> WarehousingLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int> { [LimitMaxWarehouses] = 1 },
        [ModuleTier.Medium] = new Dictionary<string, int> { [LimitMaxWarehouses] = 5 },
        [ModuleTier.Big] = new Dictionary<string, int> { [LimitMaxWarehouses] = 20 },
        [ModuleTier.Enterprise] = new Dictionary<string, int> { [LimitMaxWarehouses] = int.MaxValue },
    };

    // ──────────────────────────────────────────────
    // Invoicing
    // ──────────────────────────────────────────────
    public const string LimitMaxInvoicesPerMonth = "max_invoices_per_month";
    public const string LimitInvoiceHistoryMonths = "invoice_history_months";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> InvoicingLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxInvoicesPerMonth] = 50,
            [LimitInvoiceHistoryMonths] = 3,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxInvoicesPerMonth] = 200,
            [LimitInvoiceHistoryMonths] = 6,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxInvoicesPerMonth] = 1_000,
            [LimitInvoiceHistoryMonths] = 12,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxInvoicesPerMonth] = int.MaxValue,
            [LimitInvoiceHistoryMonths] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // Identity (max_users movido aquí desde ServicePlan)
    // ──────────────────────────────────────────────
    public const string LimitMaxUsers = "max_users";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> IdentityLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int> { [LimitMaxUsers] = 3 },
        [ModuleTier.Medium] = new Dictionary<string, int> { [LimitMaxUsers] = 10 },
        [ModuleTier.Big] = new Dictionary<string, int> { [LimitMaxUsers] = 25 },
        [ModuleTier.Enterprise] = new Dictionary<string, int> { [LimitMaxUsers] = int.MaxValue },
    };

    // ──────────────────────────────────────────────
    // Catalog (tipo catálogo — services-only vs full)
    // ──────────────────────────────────────────────
    public const string LimitAllowedItemKinds = "allowed_item_kinds";
    public const string AllowedItemKindsServicesOnly = "service";
    public const string AllowedItemKindsFull = "service,physical";

    // Catalog no tiene límites numéricos; usa policies ABAC.
    // Se incluye aquí para que el entitlement exista y el guard de módulo lo reconozca.

    // ──────────────────────────────────────────────
    // Training — sesiones y horas de capacitación anual
    // ──────────────────────────────────────────────
    public const string LimitMaxTrainingSessionsPerYear = "max_training_sessions_per_year";
    public const string LimitMaxTrainingHoursPerYear = "max_training_hours_per_year";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> TrainingLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxTrainingSessionsPerYear] = 2,
            [LimitMaxTrainingHoursPerYear] = 4,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxTrainingSessionsPerYear] = 6,
            [LimitMaxTrainingHoursPerYear] = 12,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxTrainingSessionsPerYear] = 12,
            [LimitMaxTrainingHoursPerYear] = 24,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxTrainingSessionsPerYear] = int.MaxValue,
            [LimitMaxTrainingHoursPerYear] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // Support — horas de soporte anual
    // ──────────────────────────────────────────────
    public const string LimitMaxSupportHoursPerYear = "max_support_hours_per_year";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> SupportLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxSupportHoursPerYear] = 8,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxSupportHoursPerYear] = 20,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxSupportHoursPerYear] = 40,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxSupportHoursPerYear] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // Repairs — Lotes y equipos en reacondicionamiento
    // ──────────────────────────────────────────────
    public const string LimitMaxActiveBatches = "max_active_batches";
    public const string LimitMaxEquipmentsPerBatch = "max_equipments_per_batch";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> RepairsLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxActiveBatches] = 10,
            [LimitMaxEquipmentsPerBatch] = 100,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxActiveBatches] = 50,
            [LimitMaxEquipmentsPerBatch] = 500,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxActiveBatches] = 200,
            [LimitMaxEquipmentsPerBatch] = 2_000,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxActiveBatches] = int.MaxValue,
            [LimitMaxEquipmentsPerBatch] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // Customers — Directorio comercial y clientes
    // ──────────────────────────────────────────────
    public const string LimitMaxCustomers = "max_customers";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> CustomersLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxCustomers] = 100,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxCustomers] = 1_000,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxCustomers] = 10_000,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxCustomers] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // Resolución
    // ──────────────────────────────────────────────

    /// <summary>
    /// Obtiene el límite por defecto del tier para un módulo.
    /// Retorna <c>null</c> si el módulo no tiene ese límite en ese tier.
    /// </summary>
    public static int? GetDefaultLimit(string moduleCode, ModuleTier tier, string limitKey)
    {
        var limits = moduleCode.ToLowerInvariant() switch
        {
            TenantModuleCodes.Inventory => InventoryLimits,
            TenantModuleCodes.Warehousing => WarehousingLimits,
            TenantModuleCodes.Invoicing => InvoicingLimits,
            TenantModuleCodes.Identity => IdentityLimits,
            TenantModuleCodes.Training => TrainingLimits,
            TenantModuleCodes.Support => SupportLimits,
            TenantModuleCodes.Repairs => RepairsLimits,
            TenantModuleCodes.Customers => CustomersLimits,
            _ => null,
        };

        if (limits is null || !limits.TryGetValue(tier, out var tierLimits))
        {
            return null;
        }

        return tierLimits.TryGetValue(limitKey, out var value) ? value : null;
    }

    /// <summary>
    /// Obtiene todos los límites por defecto para un módulo y tier.
    /// Útil al construir <see cref="ModuleEntitlement"/> desde un tier sin sobrescritos.
    /// </summary>
    public static IReadOnlyDictionary<string, int> GetDefaultsForTier(string moduleCode, ModuleTier tier)
    {
        var limits = moduleCode.ToLowerInvariant() switch
        {
            TenantModuleCodes.Inventory => InventoryLimits,
            TenantModuleCodes.Warehousing => WarehousingLimits,
            TenantModuleCodes.Invoicing => InvoicingLimits,
            TenantModuleCodes.Identity => IdentityLimits,
            TenantModuleCodes.Training => TrainingLimits,
            TenantModuleCodes.Support => SupportLimits,
            TenantModuleCodes.Repairs => RepairsLimits,
            TenantModuleCodes.Customers => CustomersLimits,
            _ => null,
        };

        if (limits is not null && limits.TryGetValue(tier, out var tierLimits))
        {
            return tierLimits;
        }

        return new Dictionary<string, int>();
    }

    /// <summary>
    /// Construye una lista de <see cref="ModuleEntitlement"/> a partir de los códigos de módulo
    /// y sus tiers. Útil para migrar datos legacy de <c>enabled_modules</c>.
    /// </summary>
    public static IReadOnlyList<ModuleEntitlement> FromModuleCodesWithTier(
        IReadOnlyList<string> moduleCodes,
        ModuleTier defaultTier = ModuleTier.Small)
    {
        var entitlements = new List<ModuleEntitlement>(moduleCodes.Count);
        foreach (var code in moduleCodes)
        {
            var normalized = code.Trim().ToLowerInvariant();
            if (!TenantModuleCodes.IsKnown(normalized))
            {
                continue;
            }

            var tier = normalized == TenantModuleCodes.Catalog ? ModuleTier.Big : defaultTier;
            entitlements.Add(ModuleEntitlement.FromTier(normalized, tier));
        }

        return entitlements;
    }
}
