using System.Globalization;
using System.Xml.Linq;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Purchases.Services;

public sealed record ParsedSriInvoiceLine(
    string ItemCode,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal Subtotal,
    decimal TaxRate,
    decimal TaxAmount,
    decimal Total);

public sealed record ParsedSriInvoice(
    string SupplierTaxId,
    string SupplierBusinessName,
    string? SupplierTradeName,
    string? SupplierAddress,
    string BuyerTaxId,
    string BuyerBusinessName,
    string InvoiceNumber,
    string AuthorizationNumber,
    DateOnly IssueDate,
    string DocumentType,
    decimal SubtotalZero,
    decimal SubtotalTaxed,
    decimal SubtotalNoSubject,
    decimal SubtotalExempt,
    decimal TaxRate,
    decimal TaxAmount,
    decimal TotalDiscount,
    decimal TotalAmount,
    string? PaymentMethodCode,
    int CreditDays,
    IReadOnlyList<ParsedSriInvoiceLine> Lines,
    string RawXml);

/// <summary>
/// Parser especializado para comprobantes electrónicos de compra del SRI (Factura 01).
/// Soporta esquemas estándar offline v1.0.0 y v1.1.0, así como comprobantes envueltos en respuestas SOAP/XML de autorización.
/// </summary>
public static class SriPurchaseXmlParser
{
    public static Result<ParsedSriInvoice> Parse(string xmlContent)
    {
        if (string.IsNullOrWhiteSpace(xmlContent))
        {
            return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.empty", "El contenido XML no puede estar vacío.", ErrorType.Validation));
        }

        try
        {
            var cleanXml = xmlContent.Trim();

            // Eliminar BOM si existe
            if (cleanXml.StartsWith('\uFEFF'))
            {
                cleanXml = cleanXml[1..];
            }

            // Si el XML vino completamente escapado en HTML (ej. &lt;?xml o &lt;ns2:RespuestaAutorizacion)
            if (cleanXml.StartsWith("&lt;", StringComparison.OrdinalIgnoreCase))
            {
                cleanXml = System.Net.WebUtility.HtmlDecode(cleanXml);
            }

            var doc = XDocument.Parse(cleanXml);
            var root = doc.Root;
            if (root is null)
            {
                return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.root_null", "El documento XML no tiene nodo raíz.", ErrorType.Validation));
            }

            // 1. Extraer número de autorización si viene en el contenedor externo
            var authElem = root.DescendantsAndSelf()
                .FirstOrDefault(e => e.Name.LocalName.Equals("numeroAutorizacion", StringComparison.OrdinalIgnoreCase));
            var authorizationNumber = authElem?.Value?.Trim();

            // 2. Extraer el elemento <factura>, ya sea que esté directamente en la raíz,
            // en un descendiente, o envuelto en un nodo <comprobante> (como CDATA o XML escapado).
            XElement? facturaElement = null;

            // ¿Existe un nodo <comprobante> en la raíz o en sus descendientes?
            var comprobanteElement = root.DescendantsAndSelf()
                .FirstOrDefault(e => e.Name.LocalName.Equals("comprobante", StringComparison.OrdinalIgnoreCase) && e.Parent != null);

            if (comprobanteElement is not null)
            {
                var innerXml = comprobanteElement.Value?.Trim();
                if (!string.IsNullOrWhiteSpace(innerXml) && innerXml.Contains('<') && innerXml.Contains('>'))
                {
                    try
                    {
                        var innerDoc = XDocument.Parse(innerXml);
                        facturaElement = innerDoc.Root?.Name.LocalName.Equals("factura", StringComparison.OrdinalIgnoreCase) == true
                            ? innerDoc.Root
                            : innerDoc.Descendants().FirstOrDefault(e => e.Name.LocalName.Equals("factura", StringComparison.OrdinalIgnoreCase));
                    }
                    catch
                    {
                        // Si falló el parseo de innerXml, intentamos buscar hijos directos de comprobanteElement
                        facturaElement = comprobanteElement.Elements()
                            .FirstOrDefault(e => e.Name.LocalName.Equals("factura", StringComparison.OrdinalIgnoreCase));
                    }
                }
                else
                {
                    facturaElement = comprobanteElement.Elements()
                        .FirstOrDefault(e => e.Name.LocalName.Equals("factura", StringComparison.OrdinalIgnoreCase));
                }
            }

            // Si no vino en <comprobante>, buscar <factura> en la raíz o en cualquier descendiente
            facturaElement ??= root.DescendantsAndSelf()
                .FirstOrDefault(e => e.Name.LocalName.Equals("factura", StringComparison.OrdinalIgnoreCase));

            if (facturaElement is null)
            {
                var otherDoc = root.DescendantsAndSelf()
                    .FirstOrDefault(e => e.Name.LocalName.Equals("notaCredito", StringComparison.OrdinalIgnoreCase)
                                      || e.Name.LocalName.Equals("comprobanteRetencion", StringComparison.OrdinalIgnoreCase)
                                      || e.Name.LocalName.Equals("liquidacionCompra", StringComparison.OrdinalIgnoreCase)
                                      || e.Name.LocalName.Equals("guiaRemision", StringComparison.OrdinalIgnoreCase));
                if (otherDoc is not null)
                {
                    var docFriendlyName = otherDoc.Name.LocalName switch
                    {
                        "notaCredito" => "Nota de Crédito (Tipo 04)",
                        "comprobanteRetencion" => "Comprobante de Retención (Tipo 07)",
                        "liquidacionCompra" => "Liquidación de Compra (Tipo 03)",
                        "guiaRemision" => "Guía de Remisión (Tipo 06)",
                        _ => otherDoc.Name.LocalName
                    };
                    return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.not_factura", $"El archivo XML cargado corresponde a un(a) {docFriendlyName}. En este formulario se deben registrar Facturas de Venta / Compra (Tipo 01).", ErrorType.Validation));
                }

                return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.not_factura", "El archivo XML no corresponde a una Factura Electrónica del SRI (<factura>).", ErrorType.Validation));
            }

            // 1. infoTributaria
            var infoTrib = Elem(facturaElement, "infoTributaria");
            if (infoTrib is null)
            {
                return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.info_tributaria_missing", "Falta el bloque <infoTributaria> en la factura.", ErrorType.Validation));
            }

            var supplierRuc = Elem(infoTrib, "ruc")?.Value?.Trim() ?? string.Empty;
            var supplierRazonSocial = Elem(infoTrib, "razonSocial")?.Value?.Trim() ?? string.Empty;
            var supplierNombreComercial = Elem(infoTrib, "nombreComercial")?.Value?.Trim();
            var supplierDirMatriz = Elem(infoTrib, "dirMatriz")?.Value?.Trim();
            var claveAcceso = Elem(infoTrib, "claveAcceso")?.Value?.Trim() ?? string.Empty;
            var codDoc = Elem(infoTrib, "codDoc")?.Value?.Trim() ?? "01";
            var estab = Elem(infoTrib, "estab")?.Value?.Trim() ?? "001";
            var ptoEmi = Elem(infoTrib, "ptoEmi")?.Value?.Trim() ?? "001";
            var secuencial = Elem(infoTrib, "secuencial")?.Value?.Trim() ?? "000000001";

            var invoiceNumber = $"{estab.PadLeft(3, '0')}-{ptoEmi.PadLeft(3, '0')}-{secuencial.PadLeft(9, '0')}";
            var authNumberFinal = !string.IsNullOrWhiteSpace(authorizationNumber) ? authorizationNumber : claveAcceso;

            // 2. infoFactura
            var infoFactura = Elem(facturaElement, "infoFactura");
            if (infoFactura is null)
            {
                return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.info_factura_missing", "Falta el bloque <infoFactura> en la factura.", ErrorType.Validation));
            }

            // Si dirMatriz no vino en infoTributaria, usar dirEstablecimiento de infoFactura como respaldo
            if (string.IsNullOrWhiteSpace(supplierDirMatriz))
            {
                supplierDirMatriz = Elem(infoFactura, "dirEstablecimiento")?.Value?.Trim();
            }

            var fechaEmisionStr = Elem(infoFactura, "fechaEmision")?.Value?.Trim();
            var issueDate = ParseSriDate(fechaEmisionStr);

            var buyerRuc = Elem(infoFactura, "identificacionComprador")?.Value?.Trim() ?? string.Empty;
            var buyerRazonSocial = Elem(infoFactura, "razonSocialComprador")?.Value?.Trim() ?? string.Empty;
            var totalDescuento = ParseDecimal(Elem(infoFactura, "totalDescuento")?.Value);
            var importeTotal = ParseDecimal(Elem(infoFactura, "importeTotal")?.Value);

            // Desglose de impuestos en totalConImpuestos
            decimal subtotalZero = 0;
            decimal subtotalTaxed = 0;
            decimal subtotalNoSubject = 0;
            decimal subtotalExempt = 0;
            decimal totalTaxAmount = 0;
            decimal predominantTaxRate = 15m;

            var totalConImpuestos = Elem(infoFactura, "totalConImpuestos");
            if (totalConImpuestos is not null)
            {
                foreach (var totalImp in Elems(totalConImpuestos, "totalImpuesto"))
                {
                    var codigo = Elem(totalImp, "codigo")?.Value?.Trim();
                    if (codigo == "2") // IVA
                    {
                        var codPorcentaje = Elem(totalImp, "codigoPorcentaje")?.Value?.Trim();
                        var baseImp = ParseDecimal(Elem(totalImp, "baseImponible")?.Value);
                        var valor = ParseDecimal(Elem(totalImp, "valor")?.Value);

                        switch (codPorcentaje)
                        {
                            case "0": // 0%
                                subtotalZero += baseImp;
                                break;
                            case "2": // 12%
                                subtotalTaxed += baseImp;
                                totalTaxAmount += valor;
                                predominantTaxRate = 12m;
                                break;
                            case "3": // 14%
                                subtotalTaxed += baseImp;
                                totalTaxAmount += valor;
                                predominantTaxRate = 14m;
                                break;
                            case "4": // 15%
                                subtotalTaxed += baseImp;
                                totalTaxAmount += valor;
                                predominantTaxRate = 15m;
                                break;
                            case "5": // 5%
                                subtotalTaxed += baseImp;
                                totalTaxAmount += valor;
                                predominantTaxRate = 5m;
                                break;
                            case "6": // No objeto
                                subtotalNoSubject += baseImp;
                                break;
                            case "7": // Exento
                                subtotalExempt += baseImp;
                                break;
                            case "10": // 13%
                                subtotalTaxed += baseImp;
                                totalTaxAmount += valor;
                                predominantTaxRate = 13m;
                                break;
                            default:
                                if (baseImp > 0)
                                {
                                    subtotalTaxed += baseImp;
                                    totalTaxAmount += valor;
                                }
                                break;
                        }
                    }
                }
            }

            // Pagos y crédito
            string? paymentMethodCode = null;
            int creditDays = 0;
            var pagos = Elem(infoFactura, "pagos");
            if (pagos is not null)
            {
                var primerPago = Elems(pagos, "pago").FirstOrDefault();
                if (primerPago is not null)
                {
                    paymentMethodCode = Elem(primerPago, "formaPago")?.Value?.Trim();
                    var plazoStr = Elem(primerPago, "plazo")?.Value?.Trim();
                    if (int.TryParse(plazoStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var plazoVal))
                    {
                        creditDays = Math.Max(0, plazoVal);
                    }
                }
            }

            // 3. Detalles / Líneas de compra
            var lines = new List<ParsedSriInvoiceLine>();
            var detalles = Elem(facturaElement, "detalles");
            if (detalles is not null)
            {
                foreach (var det in Elems(detalles, "detalle"))
                {
                    var codigoPrincipal = Elem(det, "codigoPrincipal")?.Value?.Trim()
                        ?? Elem(det, "codigoInterno")?.Value?.Trim()
                        ?? Elem(det, "codigoAuxiliar")?.Value?.Trim()
                        ?? string.Empty;
                    var descripcion = Elem(det, "descripcion")?.Value?.Trim() ?? "Ítem sin descripción";
                    var cantidad = ParseDecimal(Elem(det, "cantidad")?.Value, 1m);
                    var precioUnitario = ParseDecimal(Elem(det, "precioUnitario")?.Value, 0m);
                    var descuento = ParseDecimal(Elem(det, "descuento")?.Value, 0m);
                    var precioTotalSinImpuesto = ParseDecimal(Elem(det, "precioTotalSinImpuesto")?.Value, cantidad * precioUnitario - descuento);

                    decimal lineTaxRate = 0;
                    decimal lineTaxAmount = 0;

                    var impuestos = Elem(det, "impuestos");
                    if (impuestos is not null)
                    {
                        var primerImpuesto = Elems(impuestos, "impuesto").FirstOrDefault(i => Elem(i, "codigo")?.Value?.Trim() == "2");
                        if (primerImpuesto is not null)
                        {
                            var tarifaStr = Elem(primerImpuesto, "tarifa")?.Value?.Trim();
                            if (!string.IsNullOrWhiteSpace(tarifaStr) && decimal.TryParse(tarifaStr, NumberStyles.Number, CultureInfo.InvariantCulture, out var t))
                            {
                                lineTaxRate = t;
                            }
                            else
                            {
                                var cp = Elem(primerImpuesto, "codigoPorcentaje")?.Value?.Trim();
                                lineTaxRate = cp switch
                                {
                                    "0" => 0m,
                                    "2" => 12m,
                                    "3" => 14m,
                                    "4" => 15m,
                                    "5" => 5m,
                                    "10" => 13m,
                                    _ => 0m
                                };
                            }
                            lineTaxAmount = ParseDecimal(Elem(primerImpuesto, "valor")?.Value, Math.Round(precioTotalSinImpuesto * (lineTaxRate / 100m), 2));
                        }
                    }

                    var lineTotal = precioTotalSinImpuesto + lineTaxAmount;

                    lines.Add(new ParsedSriInvoiceLine(
                        ItemCode: codigoPrincipal,
                        Description: descripcion,
                        Quantity: cantidad,
                        UnitPrice: precioUnitario,
                        Discount: descuento,
                        Subtotal: precioTotalSinImpuesto,
                        TaxRate: lineTaxRate,
                        TaxAmount: lineTaxAmount,
                        Total: lineTotal
                    ));
                }
            }

            var parsed = new ParsedSriInvoice(
                SupplierTaxId: supplierRuc,
                SupplierBusinessName: supplierRazonSocial,
                SupplierTradeName: supplierNombreComercial,
                SupplierAddress: supplierDirMatriz,
                BuyerTaxId: buyerRuc,
                BuyerBusinessName: buyerRazonSocial,
                InvoiceNumber: invoiceNumber,
                AuthorizationNumber: authNumberFinal,
                IssueDate: issueDate,
                DocumentType: codDoc,
                SubtotalZero: Math.Round(subtotalZero, 2, MidpointRounding.AwayFromZero),
                SubtotalTaxed: Math.Round(subtotalTaxed, 2, MidpointRounding.AwayFromZero),
                SubtotalNoSubject: Math.Round(subtotalNoSubject, 2, MidpointRounding.AwayFromZero),
                SubtotalExempt: Math.Round(subtotalExempt, 2, MidpointRounding.AwayFromZero),
                TaxRate: predominantTaxRate,
                TaxAmount: Math.Round(totalTaxAmount, 2, MidpointRounding.AwayFromZero),
                TotalDiscount: Math.Round(totalDescuento, 2, MidpointRounding.AwayFromZero),
                TotalAmount: Math.Round(importeTotal, 2, MidpointRounding.AwayFromZero),
                PaymentMethodCode: paymentMethodCode,
                CreditDays: creditDays,
                Lines: lines.AsReadOnly(),
                RawXml: cleanXml
            );

            return Result.Success(parsed);
        }
        catch (Exception ex)
        {
            return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.parse_error", $"Error al procesar el XML de la factura SRI: {ex.Message}", ErrorType.Validation));
        }
    }

    private static DateOnly ParseSriDate(string? dateStr)
    {
        if (string.IsNullOrWhiteSpace(dateStr))
        {
            return DateOnly.FromDateTime(DateTime.UtcNow);
        }

        var clean = dateStr.Trim();
        var formats = new[] { "dd/MM/yyyy", "yyyy-MM-dd", "d/M/yyyy", "dd-MM-yyyy" };

        if (DateOnly.TryParseExact(clean, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            return date;
        }

        if (DateTime.TryParse(clean, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
        {
            return DateOnly.FromDateTime(dt);
        }

        return DateOnly.FromDateTime(DateTime.UtcNow);
    }

    private static decimal ParseDecimal(string? val, decimal defaultValue = 0m)
    {
        if (string.IsNullOrWhiteSpace(val))
        {
            return defaultValue;
        }

        var clean = val.Trim();
        if (clean.Contains(',') && !clean.Contains('.'))
        {
            clean = clean.Replace(',', '.');
        }

        return decimal.TryParse(clean, NumberStyles.Number | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var result)
            ? result
            : defaultValue;
    }

    private static XElement? Elem(XElement? parent, string localName) =>
        parent?.Elements().FirstOrDefault(e => e.Name.LocalName.Equals(localName, StringComparison.OrdinalIgnoreCase));

    private static IEnumerable<XElement> Elems(XElement? parent, string localName) =>
        parent?.Elements().Where(e => e.Name.LocalName.Equals(localName, StringComparison.OrdinalIgnoreCase)) ?? [];
}

