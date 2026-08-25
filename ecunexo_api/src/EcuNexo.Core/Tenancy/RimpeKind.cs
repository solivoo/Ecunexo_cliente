namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Régimen RIMPE declarado por la empresa. No se calcula desde CIIU.
/// </summary>
public enum RimpeKind
{
    None = 0,
    PopularBusiness = 1,
    Entrepreneur = 2,
}

public static class RimpeKindCodes
{
    public const string None = "none";
    public const string PopularBusiness = "popular-business";
    public const string Entrepreneur = "entrepreneur";

    public static string ToApiCode(this RimpeKind kind) =>
        kind switch
        {
            RimpeKind.PopularBusiness => PopularBusiness,
            RimpeKind.Entrepreneur => Entrepreneur,
            _ => None,
        };

    public static bool TryParse(string? value, out RimpeKind kind)
    {
        if (value is null)
        {
            kind = RimpeKind.None;
            return false;
        }

        switch (value.Trim().ToLowerInvariant())
        {
            case None or "no" or "":
                kind = RimpeKind.None;
                return true;
            case PopularBusiness or "popular" or "negocio-popular":
                kind = RimpeKind.PopularBusiness;
                return true;
            case Entrepreneur or "emprendedor":
                kind = RimpeKind.Entrepreneur;
                return true;
            default:
                kind = RimpeKind.None;
                return false;
        }
    }

    /// <summary>
    /// El código de API manda. Si no viene, el bool legado <c>isRimpe</c> se interpreta como Emprendedor.
    /// </summary>
    public static RimpeKind FromApi(string? rimpeKind, bool isRimpe)
    {
        if (rimpeKind is not null && TryParse(rimpeKind, out var parsed))
        {
            return parsed;
        }

        return isRimpe ? RimpeKind.Entrepreneur : RimpeKind.None;
    }
}
