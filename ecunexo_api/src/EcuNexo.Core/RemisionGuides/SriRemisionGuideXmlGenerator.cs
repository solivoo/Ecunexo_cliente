using System.Globalization;
using System.Xml.Linq;

namespace EcuNexo.Core.RemisionGuides;

/// <summary>
/// Generador de XML oficial para Guías de Remisión (SRI Comprobante Tipo 06),
/// conforme a la Ficha Técnica de Comprobantes Electrónicos Esquema Offline v2.32 / XSD v1.1.0.
/// </summary>
public static class SriRemisionGuideXmlGenerator
{
    public static string GenerateXml(
        RemisionGuide guide,
        string emitterRuc,
        string emitterRazonSocial,
        string? emitterNombreComercial,
        string emitterDirMatriz,
        string environment = "1",
        bool obligatedAccounting = true,
        bool isRimpe = false)
    {
        ArgumentNullException.ThrowIfNull(guide);

        var cleanRuc = emitterRuc.Trim();
        var cleanRazon = emitterRazonSocial.Trim();
        var cleanMatriz = string.IsNullOrWhiteSpace(emitterDirMatriz) ? "Quito, Ecuador" : emitterDirMatriz.Trim();
        var env = environment == "2" ? "2" : "1";

        // 1. infoTributaria
        var infoTrib = new XElement("infoTributaria",
            new XElement("ambiente", env),
            new XElement("tipoEmision", "1"),
            new XElement("razonSocial", cleanRazon),
            string.IsNullOrWhiteSpace(emitterNombreComercial) ? null : new XElement("nombreComercial", emitterNombreComercial.Trim()),
            new XElement("ruc", cleanRuc),
            new XElement("claveAcceso", guide.AccessKey),
            new XElement("codDoc", "06"),
            new XElement("estab", guide.Establishment),
            new XElement("ptoEmi", guide.EmissionPoint),
            new XElement("secuencial", guide.Sequential),
            new XElement("dirMatriz", cleanMatriz)
        );

        if (isRimpe)
        {
            infoTrib.Add(new XElement("contribuyenteRimpe", "CONTRIBUYENTE RÉGIMEN RIMPE"));
        }

        // 2. infoGuiaRemision
        var infoGuia = new XElement("infoGuiaRemision",
            new XElement("dirEstablecimiento", cleanMatriz),
            new XElement("dirPartida", guide.StartingAddress),
            new XElement("razonSocialTransportista", guide.CarrierName),
            new XElement("tipoIdentificacionTransportista", guide.CarrierIdentificationType),
            new XElement("rucTransportista", guide.CarrierIdentification),
            new XElement("obligadoContabilidad", obligatedAccounting ? "SI" : "NO"),
            new XElement("fechaIniTransporte", guide.StartDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)),
            new XElement("fechaFinTransporte", guide.EndDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)),
            new XElement("placa", guide.LicensePlate)
        );

        // 3. destinatarios
        var detallesElem = new XElement("detalles");
        foreach (var item in guide.Items)
        {
            var detalle = new XElement("detalle",
                new XElement("codigoInterno", item.ItemCode),
                new XElement("descripcion", item.Description),
                new XElement("cantidad", item.Quantity.ToString("0.00", CultureInfo.InvariantCulture))
            );
            detallesElem.Add(detalle);
        }

        var destinatarioElem = new XElement("destinatario",
            new XElement("identificacionDestinatario", guide.RecipientIdentification),
            new XElement("tipoIdentificacionDestinatario", guide.RecipientIdentificationType),
            new XElement("razonSocialDestinatario", guide.RecipientName),
            new XElement("dirDestinatario", guide.RecipientAddress),
            new XElement("motivoTraslado", guide.TransferReason),
            string.IsNullOrWhiteSpace(guide.CustomsDocumentNumber) ? null : new XElement("docAduaneroUnico", guide.CustomsDocumentNumber.Trim()),
            new XElement("ruta", guide.RouteDescription),
            string.IsNullOrWhiteSpace(guide.SupportDocumentType) ? null : new XElement("codDocSustento", guide.SupportDocumentType.Trim()),
            string.IsNullOrWhiteSpace(guide.SupportDocumentNumber) ? null : new XElement("numDocSustento", guide.SupportDocumentNumber.Trim()),
            string.IsNullOrWhiteSpace(guide.SupportDocumentAuth) ? null : new XElement("numAutDocSustento", guide.SupportDocumentAuth.Trim()),
            string.IsNullOrWhiteSpace(guide.SupportDocumentNumber) ? null : new XElement("fechaEmisionDocSustento", guide.IssueDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)),
            detallesElem
        );

        var destinatarios = new XElement("destinatarios", destinatarioElem);

        // 4. infoAdicional (opcional)
        XElement? infoAdicional = null;
        var adicList = new List<XElement>();
        if (!string.IsNullOrWhiteSpace(guide.CarrierEmail))
        {
            adicList.Add(new XElement("campoAdicional", new XAttribute("nombre", "EmailTransportista"), guide.CarrierEmail.Trim()));
        }
        if (!string.IsNullOrWhiteSpace(guide.CarrierPhone))
        {
            adicList.Add(new XElement("campoAdicional", new XAttribute("nombre", "TelefonoTransportista"), guide.CarrierPhone.Trim()));
        }
        if (adicList.Count > 0)
        {
            infoAdicional = new XElement("infoAdicional", adicList);
        }

        var doc = new XDocument(
            new XDeclaration("1.0", "utf-8", "yes"),
            new XElement("guiaRemision",
                new XAttribute("id", "comprobante"),
                new XAttribute("version", "1.1.0"),
                infoTrib,
                infoGuia,
                destinatarios,
                infoAdicional
            )
        );

        return doc.ToString();
    }
}
