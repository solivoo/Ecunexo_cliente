namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Módulos de producto habilitables vía licencia / <c>enabled_modules</c>.
/// <c>identity</c> es obligatorio en emisión comercial.
/// <c>catalog</c> es maestro; <c>inventory</c> y <c>warehousing</c> dependen de ítems físicos en catálogo (ADR-009).
/// </summary>
public static class TenantModuleCodes
{
    public const string Identity = "identity";

    public const string Catalog = "catalog";

    public const string Warehousing = "warehousing";

    public const string Inventory = "inventory";

    public const string Invoicing = "facturacion";

    public const string Accounting = "contabilidad";

    public const string Training = "training";

    public const string Support = "support";

    public static readonly IReadOnlyList<string> All =
        [Identity, Catalog, Warehousing, Inventory, Invoicing, Accounting, Training, Support];

    public static bool IsKnown(string code) =>
        All.Any(c => string.Equals(c, code, StringComparison.OrdinalIgnoreCase));

    /// <summary>Normaliza un código de módulo para persistencia (trim + minúsculas invariantes).</summary>
    public static string Normalize(string code)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        return code.Trim().ToLowerInvariant();
    }

    /// <summary>Igual que <see cref="Normalize"/>; <see langword="null"/> o blanco → <see langword="null"/>.</summary>
    public static string? NormalizeOrNull(string? code) =>
        string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToLowerInvariant();

    /// <summary>
    /// Minúsculas más alias históricos (<c>invoicing</c> → <c>facturacion</c>, <c>accounting</c> → <c>contabilidad</c>).
    /// </summary>
    public static string Canonicalize(string code)
    {
        var normalized = Normalize(code);
        return normalized switch
        {
            "invoicing" => Invoicing,
            "accounting" => Accounting,
            _ => normalized,
        };
    }

    public static string? CanonicalizeOrNull(string? code) =>
        string.IsNullOrWhiteSpace(code) ? null : Canonicalize(code);
}
