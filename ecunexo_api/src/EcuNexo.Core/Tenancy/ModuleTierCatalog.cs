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
    // Invoicing (Facturación Electrónica SRI: Facturas, Notas de Crédito, Guías de Remisión)
    // ──────────────────────────────────────────────
    public const string LimitMaxInvoicesPerMonth = "max_invoices_per_month";
    public const string LimitInvoiceHistoryMonths = "invoice_history_months";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> InvoicingLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxInvoicesPerMonth] = 50,
            [LimitInvoiceHistoryMonths] = 3,
            [LimitMaxMonthlyCreditNotes] = 20,
            [LimitMaxMonthlyRemisionGuides] = 50,
            [LimitMaxActiveCarriers] = 5,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxInvoicesPerMonth] = 200,
            [LimitInvoiceHistoryMonths] = 6,
            [LimitMaxMonthlyCreditNotes] = 100,
            [LimitMaxMonthlyRemisionGuides] = 250,
            [LimitMaxActiveCarriers] = 20,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxInvoicesPerMonth] = 1_000,
            [LimitInvoiceHistoryMonths] = 12,
            [LimitMaxMonthlyCreditNotes] = 500,
            [LimitMaxMonthlyRemisionGuides] = 1_000,
            [LimitMaxActiveCarriers] = 50,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxInvoicesPerMonth] = int.MaxValue,
            [LimitInvoiceHistoryMonths] = int.MaxValue,
            [LimitMaxMonthlyCreditNotes] = int.MaxValue,
            [LimitMaxMonthlyRemisionGuides] = int.MaxValue,
            [LimitMaxActiveCarriers] = int.MaxValue,
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
    // Catalog (tipo catálogo, producto matriz y variantes multidimensionales)
    // ──────────────────────────────────────────────
    public const string LimitAllowedItemKinds = "allowed_item_kinds";
    public const string AllowedItemKindsServicesOnly = "service";
    public const string AllowedItemKindsFull = "service,physical";
    public const string LimitMaxActiveVariants = "max_active_variants";
    public const string LimitMaxVariants = "max_variants";
    public const string LimitMaxProductTemplates = "max_product_templates";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> CatalogLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxActiveVariants] = 100,
            [LimitMaxVariants] = 100,
            [LimitMaxProductTemplates] = 10,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxActiveVariants] = 1_000,
            [LimitMaxVariants] = 1_000,
            [LimitMaxProductTemplates] = 50,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxActiveVariants] = 10_000,
            [LimitMaxVariants] = 10_000,
            [LimitMaxProductTemplates] = 200,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxActiveVariants] = int.MaxValue,
            [LimitMaxVariants] = int.MaxValue,
            [LimitMaxProductTemplates] = int.MaxValue,
        },
    };

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
    // Ecommerce — Pedidos online y reservas
    // ──────────────────────────────────────────────
    public const string LimitMaxOrdersPerMonth = "max_orders_per_month";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> EcommerceLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxOrdersPerMonth] = 100,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxOrdersPerMonth] = 1_000,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxOrdersPerMonth] = 5_000,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxOrdersPerMonth] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // Purchases — Compras
    // ──────────────────────────────────────────────
    public const string LimitMaxMonthlyPurchases = "max_monthly_purchases";
    public const string LimitMonthlyPurchasesProcessed = "monthly_purchases_processed";
    public const string LimitMaxSuppliers = "max_suppliers";
    public const string LimitMaxMonthlyWithholdings = "max_monthly_withholdings";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> PurchasesLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMonthlyPurchasesProcessed] = 50,
            [LimitMaxMonthlyPurchases] = 50,
            [LimitMaxSuppliers] = 25,
            [LimitMaxMonthlyWithholdings] = 50,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMonthlyPurchasesProcessed] = 250,
            [LimitMaxMonthlyPurchases] = 250,
            [LimitMaxSuppliers] = 100,
            [LimitMaxMonthlyWithholdings] = 250,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMonthlyPurchasesProcessed] = 1_000,
            [LimitMaxMonthlyPurchases] = 1_000,
            [LimitMaxSuppliers] = 500,
            [LimitMaxMonthlyWithholdings] = 1_000,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMonthlyPurchasesProcessed] = int.MaxValue,
            [LimitMaxMonthlyPurchases] = int.MaxValue,
            [LimitMaxSuppliers] = int.MaxValue,
            [LimitMaxMonthlyWithholdings] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // Accounting — Contabilidad NIIF, Pre-declaración SRI & Balances SCVS
    // ──────────────────────────────────────────────
    public const string LimitMaxAccountsInChart = "max_accounts_in_chart";
    public const string LimitMaxChartAccounts = "max_chart_accounts";
    public const string LimitMaxMonthlyJournalEntries = "max_monthly_journal_entries";
    public const string LimitAllowFinancialStatementsExport = "allow_financial_statements_export";
    public const string LimitEnableCustomSubaccounts = "enable_custom_subaccounts";
    public const string LimitAllowCustomSubaccounts = "allow_custom_subaccounts";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> AccountingLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyJournalEntries] = 50,
            [LimitMaxAccountsInChart] = 60,
            [LimitMaxChartAccounts] = 60,
            [LimitAllowFinancialStatementsExport] = 0,
            [LimitEnableCustomSubaccounts] = 0,
            [LimitAllowCustomSubaccounts] = 0,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyJournalEntries] = 500,
            [LimitMaxAccountsInChart] = 250,
            [LimitMaxChartAccounts] = 250,
            [LimitAllowFinancialStatementsExport] = 1,
            [LimitEnableCustomSubaccounts] = 1,
            [LimitAllowCustomSubaccounts] = 1,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyJournalEntries] = 5_000,
            [LimitMaxAccountsInChart] = 1_000,
            [LimitMaxChartAccounts] = 1_000,
            [LimitAllowFinancialStatementsExport] = 1,
            [LimitEnableCustomSubaccounts] = 1,
            [LimitAllowCustomSubaccounts] = 1,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyJournalEntries] = int.MaxValue,
            [LimitMaxAccountsInChart] = int.MaxValue,
            [LimitMaxChartAccounts] = int.MaxValue,
            [LimitAllowFinancialStatementsExport] = 1,
            [LimitEnableCustomSubaccounts] = 1,
            [LimitAllowCustomSubaccounts] = 1,
        },
    };

    // ──────────────────────────────────────────────
    // RemisionGuides — Guías de Remisión Electrónicas SRI (Tipo 06) & Logística
    // ──────────────────────────────────────────────
    public const string LimitMaxMonthlyRemisionGuides = "max_monthly_remision_guides";
    public const string LimitMaxActiveCarriers = "max_active_carriers";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> RemisionGuidesLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyRemisionGuides] = 50,
            [LimitMaxActiveCarriers] = 5,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyRemisionGuides] = 250,
            [LimitMaxActiveCarriers] = 20,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyRemisionGuides] = 1_000,
            [LimitMaxActiveCarriers] = 50,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyRemisionGuides] = int.MaxValue,
            [LimitMaxActiveCarriers] = int.MaxValue,
        },
    };

    // ──────────────────────────────────────────────
    // CreditNotes — Notas de Crédito y Anulaciones SRI (Comprobante 04)
    // ──────────────────────────────────────────────
    public const string LimitMaxMonthlyCreditNotes = "max_monthly_credit_notes";

    private static readonly Dictionary<ModuleTier, IReadOnlyDictionary<string, int>> CreditNotesLimits = new()
    {
        [ModuleTier.Small] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyCreditNotes] = 20,
        },
        [ModuleTier.Medium] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyCreditNotes] = 100,
        },
        [ModuleTier.Big] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyCreditNotes] = 500,
        },
        [ModuleTier.Enterprise] = new Dictionary<string, int>
        {
            [LimitMaxMonthlyCreditNotes] = int.MaxValue,
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
            TenantModuleCodes.Catalog or "catalog" or "catalog.matrix" or "catalog_matrix" or "matrix" or "catalog-matrix" => CatalogLimits,
            TenantModuleCodes.Identity => IdentityLimits,
            TenantModuleCodes.Training => TrainingLimits,
            TenantModuleCodes.Support => SupportLimits,
            TenantModuleCodes.Repairs => RepairsLimits,
            TenantModuleCodes.Customers => CustomersLimits,
            TenantModuleCodes.Ecommerce => EcommerceLimits,
            TenantModuleCodes.Purchases => PurchasesLimits,
            TenantModuleCodes.Accounting or "accounting" => AccountingLimits,
            TenantModuleCodes.RemisionGuides or "billing.remision_guides" or "remision_guides" => InvoicingLimits,
            TenantModuleCodes.CreditNotes or "credit_notes" or "notas_credito" or "notas-credito" or "billing.credit_notes" => InvoicingLimits,
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
            TenantModuleCodes.Catalog or "catalog" or "catalog.matrix" or "catalog_matrix" or "matrix" or "catalog-matrix" => CatalogLimits,
            TenantModuleCodes.Identity => IdentityLimits,
            TenantModuleCodes.Training => TrainingLimits,
            TenantModuleCodes.Support => SupportLimits,
            TenantModuleCodes.Repairs => RepairsLimits,
            TenantModuleCodes.Customers => CustomersLimits,
            TenantModuleCodes.Ecommerce => EcommerceLimits,
            TenantModuleCodes.Purchases => PurchasesLimits,
            TenantModuleCodes.Accounting or "accounting" => AccountingLimits,
            TenantModuleCodes.RemisionGuides or "billing.remision_guides" or "remision_guides" => InvoicingLimits,
            TenantModuleCodes.CreditNotes or "credit_notes" or "notas_credito" or "notas-credito" or "billing.credit_notes" => InvoicingLimits,
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
