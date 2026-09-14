using System.Globalization;

namespace EcuNexo.Core.Purchases.Services;

/// <summary>
/// Generador de claves de acceso de 49 dígitos para comprobantes electrónicos del SRI (Ecuador),
/// conforme a la Ficha Técnica de Comprobantes Electrónicos Esquema Offline v2.32.
/// </summary>
public static class SriAccessKeyGenerator
{
    /// <summary>
    /// Genera una clave de acceso reglamentaria de 49 dígitos con dígito verificador Módulo 11.
    /// </summary>
    /// <param name="issueDate">Fecha de emisión del comprobante.</param>
    /// <param name="documentType">Tipo de comprobante ('01' Factura, '03' Liquidación de compra, '04' Nota de crédito, '07' Retención).</param>
    /// <param name="emitterRuc">RUC del emisor (13 dígitos).</param>
    /// <param name="environment">Ambiente ('1' Pruebas / '2' Producción).</param>
    /// <param name="establishment">Código de establecimiento (3 dígitos, ej. '001').</param>
    /// <param name="emissionPoint">Código de punto de emisión (3 dígitos, ej. '001').</param>
    /// <param name="sequential">Secuencial numérico (hasta 9 dígitos, ej. '000000001').</param>
    /// <param name="numericCode">Código numérico de seguridad de 8 dígitos (opcional, generado al azar si es nulo).</param>
    /// <param name="emissionType">Tipo de emisión (siempre '1' Normal en esquema offline).</param>
    public static string Generate(
        DateOnly issueDate,
        string documentType,
        string emitterRuc,
        string environment = "1",
        string establishment = "001",
        string emissionPoint = "001",
        string sequential = "1",
        string? numericCode = null,
        string emissionType = "1")
    {
        // 1. Fecha en formato ddmmaaaa (8 dígitos)
        var datePart = issueDate.ToString("ddMMyyyy", CultureInfo.InvariantCulture);

        // 2. Tipo comprobante (2 dígitos)
        var docTypePart = documentType.PadLeft(2, '0');

        // 3. RUC emisor (13 dígitos)
        var cleanRuc = emitterRuc.Trim().PadLeft(13, '0');
        if (cleanRuc.Length > 13)
        {
            cleanRuc = cleanRuc[..13];
        }

        // 4. Tipo ambiente (1 dígito: 1 Pruebas, 2 Producción)
        var envPart = environment == "2" ? "2" : "1";

        // 5. Serie: establecimiento (3 dígitos) + punto emision (3 dígitos)
        var estabPart = establishment.Trim().PadLeft(3, '0');
        if (estabPart.Length > 3)
        {
            estabPart = estabPart[..3];
        }

        var ptoPart = emissionPoint.Trim().PadLeft(3, '0');
        if (ptoPart.Length > 3)
        {
            ptoPart = ptoPart[..3];
        }

        // 6. Secuencial (9 dígitos)
        var cleanSeq = sequential.Trim();
        if (cleanSeq.Contains('-'))
        {
            var parts = cleanSeq.Split('-');
            cleanSeq = parts[^1];
        }
        var seqPart = cleanSeq.PadLeft(9, '0');
        if (seqPart.Length > 9)
        {
            seqPart = seqPart[^9..];
        }

        // 7. Código numérico de seguridad (8 dígitos)
        string numCodePart;
        if (!string.IsNullOrWhiteSpace(numericCode) && numericCode.Trim().All(char.IsDigit))
        {
            numCodePart = numericCode.Trim().PadLeft(8, '0');
            if (numCodePart.Length > 8)
            {
                numCodePart = numCodePart[..8];
            }
        }
        else
        {
            // Código numérico determinista o pseudoaleatorio pero estable
            var rnd = Math.Abs(HashCode.Combine(datePart, docTypePart, cleanRuc, seqPart)) % 100000000;
            numCodePart = rnd.ToString(CultureInfo.InvariantCulture).PadLeft(8, '7');
        }

        // 8. Tipo emisión (1 dígito)
        var emiTypePart = emissionType == "2" ? "2" : "1";

        // Primeros 48 dígitos
        var partialKey = $"{datePart}{docTypePart}{cleanRuc}{envPart}{estabPart}{ptoPart}{seqPart}{numCodePart}{emiTypePart}";

        // 9. Cálculo de dígito verificador Módulo 11 (factor 2 al 7)
        int factor = 2;
        int sum = 0;
        for (int i = 47; i >= 0; i--)
        {
            sum += (partialKey[i] - '0') * factor;
            factor = factor == 7 ? 2 : factor + 1;
        }

        int remainder = sum % 11;
        int checkDigit = 11 - remainder;
        if (checkDigit == 11)
        {
            checkDigit = 0;
        }
        else if (checkDigit == 10)
        {
            checkDigit = 1;
        }

        return $"{partialKey}{checkDigit.ToString(CultureInfo.InvariantCulture)}";
    }
}
