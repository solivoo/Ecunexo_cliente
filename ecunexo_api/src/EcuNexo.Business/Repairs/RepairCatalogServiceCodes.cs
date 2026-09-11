using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs;

/// <summary>
/// Servicios canónicos de reacondicionamiento en catálogo (identidad fiscal SRI).
/// </summary>
public static class RepairCatalogServiceCodes
{
    public const string Level1Sku = "REP-N1";
    public const string Level2Sku = "REP-N2";
    public const string Level3Sku = "REP-N3";

    public static string SkuFor(DamageLevel level) => level switch
    {
        DamageLevel.Level1 => Level1Sku,
        DamageLevel.Level2 => Level2Sku,
        DamageLevel.Level3 => Level3Sku,
        _ => $"REP-N{(int)level}",
    };

    public static string NameFor(DamageLevel level) => level switch
    {
        DamageLevel.Level1 => "Reacondicionamiento Nivel 1 (leve / estético)",
        DamageLevel.Level2 => "Reacondicionamiento Nivel 2 (medio / chapa)",
        DamageLevel.Level3 => "Reacondicionamiento Nivel 3 (grave / estructural)",
        _ => "Reacondicionamiento",
    };
}
