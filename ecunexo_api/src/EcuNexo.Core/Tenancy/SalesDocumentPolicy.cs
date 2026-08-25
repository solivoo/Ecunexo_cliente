using EcuNexo.Core.Common;

namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Qué comprobante de venta aplica según el régimen. El SRI no tiene XML de nota de venta:
/// negocio popular emite talonario autorizado o, si lo elige, factura electrónica 01.
/// </summary>
public static class SalesDocumentPolicy
{
    public const string EntrepreneurXmlLegend = "CONTRIBUYENTE RÉGIMEN RIMPE";
    public const string PopularBusinessXmlLegend = "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE";

    public static SalesDocumentKind Resolve(RimpeKind rimpeKind, bool preferElectronicInvoice)
    {
        if (rimpeKind == RimpeKind.PopularBusiness && !preferElectronicInvoice)
        {
            return SalesDocumentKind.NotaVenta;
        }

        return SalesDocumentKind.FacturaElectronica;
    }

    public static string? XmlRimpeLegend(RimpeKind rimpeKind) =>
        rimpeKind switch
        {
            RimpeKind.Entrepreneur => EntrepreneurXmlLegend,
            RimpeKind.PopularBusiness => PopularBusinessXmlLegend,
            _ => null,
        };

    /// <summary>
    /// RUC de persona natural: tercer dígito 0–5. Sociedad: 6 o 9.
    /// </summary>
    public static bool IsNaturalPersonRuc(string? taxId)
    {
        if (string.IsNullOrWhiteSpace(taxId) || taxId.Length < 3 || !taxId.All(char.IsDigit))
        {
            return false;
        }

        var third = taxId[2];
        return third is >= '0' and <= '5';
    }

    public static Result ValidateLegalCombination(
        RimpeKind rimpeKind,
        string? taxId,
        bool isLargeTaxpayer,
        bool isSpecialTaxpayer,
        bool isWithholdingAgent)
    {
        if (rimpeKind == RimpeKind.None)
        {
            return Result.Success();
        }

        if (isLargeTaxpayer || isSpecialTaxpayer)
        {
            return Result.Failure(
                new Error(
                    "tenant.sri.rimpe.incompatible",
                    "RIMPE no se combina con gran contribuyente ni contribuyente especial.",
                    ErrorType.Validation));
        }

        if (rimpeKind == RimpeKind.PopularBusiness && isWithholdingAgent)
        {
            return Result.Failure(
                new Error(
                    "tenant.sri.rimpe.popular_withholding",
                    "Negocio popular no es agente de retención.",
                    ErrorType.Validation));
        }

        if (rimpeKind == RimpeKind.PopularBusiness
            && !string.IsNullOrWhiteSpace(taxId)
            && !IsNaturalPersonRuc(taxId))
        {
            return Result.Failure(
                new Error(
                    "tenant.sri.rimpe.popular_society",
                    "Negocio popular solo aplica a persona natural (RUC con tercer dígito 0–5).",
                    ErrorType.Validation));
        }

        return Result.Success();
    }
}
