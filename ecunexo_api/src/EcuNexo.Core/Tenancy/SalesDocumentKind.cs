namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Comprobante de venta que la empresa debe emitir. Un recibo interno no es un tipo.
/// </summary>
public enum SalesDocumentKind
{
    FacturaElectronica = 0,
    NotaVenta = 1,
}

public static class SalesDocumentKindCodes
{
    public const string FacturaElectronica = "factura-electronica";
    public const string NotaVenta = "nota-venta";

    public static string ToApiCode(this SalesDocumentKind kind) =>
        kind == SalesDocumentKind.NotaVenta ? NotaVenta : FacturaElectronica;
}
