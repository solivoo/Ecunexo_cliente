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

            var doc = XDocument.Parse(cleanXml);
            var root = doc.Root;
            if (root is null)
            {
                return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.root_null", "El documento XML no tiene nodo raíz.", ErrorType.Validation));
            }

            string? authorizationNumber = null;
            XElement? facturaElement;

            // Manejo de comprobante envuelto en <autorizacion> del WebService SRI
            if (root.Name.LocalName.Equals("autorizacion", StringComparison.OrdinalIgnoreCase))
            {
                authorizationNumber = root.Element("numeroAutorizacion")?.Value?.Trim();
                var comprobanteElement = root.Element("comprobante");
                if (comprobanteElement is null)
                {
                    return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.comprobante_missing", "No se encontró el elemento <comprobante> dentro de la autorización SRI.", ErrorType.Validation));
                }

                // El nodo comprobante puede contener un CDATA con XML embebido o elementos XML directos
                var innerXml = comprobanteElement.Value;
                if (innerXml.Contains('<') && innerXml.Contains('>'))
                {
                    var innerDoc = XDocument.Parse(innerXml);
                    facturaElement = innerDoc.Root;
                }
                else
                {
                    facturaElement = comprobanteElement.Elements().FirstOrDefault(e => e.Name.LocalName.Equals("factura", StringComparison.OrdinalIgnoreCase));
                }
            }
            else if (root.Name.LocalName.Equals("factura", StringComparison.OrdinalIgnoreCase))
            {
                facturaElement = root;
            }
            else
            {
                // Buscar <factura> en cualquier descendiente
                facturaElement = root.Descendants().FirstOrDefault(e => e.Name.LocalName.Equals("factura", StringComparison.OrdinalIgnoreCase));
            }

            if (facturaElement is null)
            {
                return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.not_factura", "El archivo XML no corresponde a una Factura Electrónica del SRI (<factura>).", ErrorType.Validation));
            }

            // 1. infoTributaria
            var infoTrib = facturaElement.Element("infoTributaria");
            if (infoTrib is null)
            {
                return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.info_tributaria_missing", "Falta el bloque <infoTributaria> en la factura.", ErrorType.Validation));
            }

            var supplierRuc = infoTrib.Element("ruc")?.Value?.Trim() ?? string.Empty;
            var supplierRazonSocial = infoTrib.Element("razonSocial")?.Value?.Trim() ?? string.Empty;
            var supplierNombreComercial = infoTrib.Element("nombreComercial")?.Value?.Trim();
            var supplierDirMatriz = infoTrib.Element("dirMatriz")?.Value?.Trim();
            var claveAcceso = infoTrib.Element("claveAcceso")?.Value?.Trim() ?? string.Empty;
            var codDoc = infoTrib.Element("codDoc")?.Value?.Trim() ?? "01";
            var estab = infoTrib.Element("estab")?.Value?.Trim() ?? "001";
            var ptoEmi = infoTrib.Element("ptoEmi")?.Value?.Trim() ?? "001";
            var secuencial = infoTrib.Element("secuencial")?.Value?.Trim() ?? "000000001";

            var invoiceNumber = $"{estab}-{ptoEmi}-{secuencial.PadLeft(9, '0')}";
            var authNumberFinal = !string.IsNullOrWhiteSpace(authorizationNumber) ? authorizationNumber : claveAcceso;

            // 2. infoFactura
            var infoFactura = facturaElement.Element("infoFactura");
            if (infoFactura is null)
            {
                return Result.Failure<ParsedSriInvoice>(new Error("sri_xml.info_factura_missing", "Falta el bloque <infoFactura> en la factura.", ErrorType.Validation));
            }

            var fechaEmisionStr = infoFactura.Element("fechaEmision")?.Value?.Trim();
            var issueDate = ParseSriDate(fechaEmisionStr);

            var buyerRuc = infoFactura.Element("identificacionComprador")?.Value?.Trim() ?? string.Empty;
            var buyerRazonSocial = infoFactura.Element("razonSocialComprador")?.Value?.Trim() ?? string.Empty;
            var totalDescuento = ParseDecimal(infoFactura.Element("totalDescuento")?.Value);
            var importeTotal = ParseDecimal(infoFactura.Element("importeTotal")?.Value);

            // Desglose de impuestos en totalConImpuestos
            decimal subtotalZero = 0;
            decimal subtotalTaxed = 0;
            decimal subtotalNoSubject = 0;
            decimal subtotalExempt = 0;
            decimal totalTaxAmount = 0;
            decimal predominantTaxRate = 15m;

            var totalConImpuestos = infoFactura.Element("totalConImpuestos");
            if (totalConImpuestos is not null)
            {
                foreach (var totalImp in totalConImpuestos.Elements("totalImpuesto"))
                {
                    var codigo = totalImp.Element("codigo")?.Value?.Trim();
                    if (codigo == "2") // IVA
                    {
                        var codPorcentaje = totalImp.Element("codigoPorcentaje")?.Value?.Trim();
                        var baseImp = ParseDecimal(totalImp.Element("baseImponible")?.Value);
                        var valor = ParseDecimal(totalImp.Element("valor")?.Value);

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
                                subtotalTaxed += baseImp;
                                totalTaxAmount += valor;
                                break;
                        }
                    }
                }
            }

            // Pagos y crédito
            string? paymentMethodCode = null;
            int creditDays = 0;
            var pagos = infoFactura.Element("pagos");
            if (pagos is not null)
            {
                var primerPago = pagos.Elements("pago").FirstOrDefault();
                if (primerPago is not null)
                {
                    paymentMethodCode = primerPago.Element("formaPago")?.Value?.Trim();
                    var plazoStr = primerPago.Element("plazo")?.Value?.Trim();
                    if (int.TryParse(plazoStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var plazoVal))
                    {
                        creditDays = Math.Max(0, plazoVal);
                    }
                }
            }

            // 3. Detalles / Líneas de compra
            var lines = new List<ParsedSriInvoiceLine>();
            var detalles = facturaElement.Element("detalles");
            if (detalles is not null)
            {
                foreach (var det in detalles.Elements("detalle"))
                {
                    var codigoPrincipal = det.Element("codigoPrincipal")?.Value?.Trim()
                        ?? det.Element("codigoInterno")?.Value?.Trim()
                        ?? string.Empty;
                    var descripcion = det.Element("descripcion")?.Value?.Trim() ?? "Ítem sin descripción";
                    var cantidad = ParseDecimal(det.Element("cantidad")?.Value, 1m);
                    var precioUnitario = ParseDecimal(det.Element("precioUnitario")?.Value, 0m);
                    var descuento = ParseDecimal(det.Element("descuento")?.Value, 0m);
                    var precioTotalSinImpuesto = ParseDecimal(det.Element("precioTotalSinImpuesto")?.Value, cantidad * precioUnitario - descuento);

                    decimal lineTaxRate = 0;
                    decimal lineTaxAmount = 0;

                    var impuestos = det.Element("impuestos");
                    if (impuestos is not null)
                    {
                        var primerImpuesto = impuestos.Elements("impuesto").FirstOrDefault(i => i.Element("codigo")?.Value?.Trim() == "2");
                        if (primerImpuesto is not null)
                        {
                            var tarifaStr = primerImpuesto.Element("tarifa")?.Value?.Trim();
                            if (!string.IsNullOrWhiteSpace(tarifaStr) && decimal.TryParse(tarifaStr, NumberStyles.Number, CultureInfo.InvariantCulture, out var t))
                            {
                                lineTaxRate = t;
                            }
                            else
                            {
                                var cp = primerImpuesto.Element("codigoPorcentaje")?.Value?.Trim();
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
                            lineTaxAmount = ParseDecimal(primerImpuesto.Element("valor")?.Value, Math.Round(precioTotalSinImpuesto * (lineTaxRate / 100m), 2));
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

        return decimal.TryParse(val.Trim(), NumberStyles.Number | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var result)
            ? result
            : defaultValue;
    }
}
