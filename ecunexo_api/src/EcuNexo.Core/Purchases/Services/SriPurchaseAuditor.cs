using System.Globalization;
using System.Xml.Linq;

namespace EcuNexo.Core.Purchases.Services;

public sealed record SriValidationAlert(
    string Severity, // "success" | "warning" | "danger" | "info"
    string Code,
    string Title,
    string Message,
    string? Recommendation = null);

public sealed record SriValidationReport(
    string OverallStatus, // "valid" | "warning" | "danger"
    bool IsAuthorizedBySri,
    string? SriStatus,
    DateTimeOffset? SriAuthorizationDate,
    string Environment,
    bool IsAccessKeyValid,
    string? AccessKeyCheckDigitExpected,
    bool IsMathConsistent,
    decimal CalculatedTotal,
    decimal DeclaredTotal,
    decimal MathDiscrepancy,
    string TaxRateStatus,
    IReadOnlyList<SriValidationAlert> Alerts);

/// <summary>
/// Auditor preventivo de comprobantes electrónicos y físicos de compra conforme a normativas del SRI Ecuador.
/// Detecta comprobantes sin autorización oficial (caída del SRI o contingencia), errores aritméticos en bases/impuestos,
/// tarifas desfasadas (12% vs 15% vigente) e inconsistencias en la clave de acceso de 49 dígitos (Módulo 11).
/// </summary>
public static class SriPurchaseAuditor
{
    private static readonly DateOnly Vat15StartDate = new(2024, 4, 1);

    public static (bool IsValid, int ExpectedCheckDigit, string? Error) ValidateAccessKeyModulo11(string? key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return (false, -1, "La clave de acceso está vacía.");
        }

        var clean = key.Trim();
        if (clean.Length != 49)
        {
            return (false, -1, $"La clave de acceso debe tener 49 dígitos numéricos (actualmente tiene {clean.Length}).");
        }

        if (!clean.All(char.IsDigit))
        {
            return (false, -1, "La clave de acceso contiene caracteres no numéricos.");
        }

        int factor = 2;
        int sum = 0;
        for (int i = 47; i >= 0; i--)
        {
            sum += (clean[i] - '0') * factor;
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

        int actualCheckDigit = clean[48] - '0';
        if (actualCheckDigit != checkDigit)
        {
            return (false, checkDigit, $"Dígito verificador inválido: calculado {checkDigit}, obtenido {actualCheckDigit}.");
        }

        return (true, checkDigit, null);
    }

    public static SriValidationReport Audit(
        XDocument xmlDoc,
        string accessKey,
        string? authorizationNumber,
        DateOnly issueDate,
        decimal subtotalZero,
        decimal subtotalTaxed,
        decimal subtotalNoSubject,
        decimal subtotalExempt,
        decimal taxRate,
        decimal taxAmount,
        decimal totalDiscount,
        decimal totalAmount,
        IReadOnlyList<ParsedSriInvoiceLine> lines)
    {
        var alerts = new List<SriValidationAlert>();

        // 1. Auditoría de Clave de Acceso (49 dígitos & Módulo 11)
        var (isKeyValid, expectedCheckDigit, keyError) = ValidateAccessKeyModulo11(accessKey);
        string? expectedCheckStr = !isKeyValid && expectedCheckDigit >= 0 ? expectedCheckDigit.ToString(CultureInfo.InvariantCulture) : null;

        if (isKeyValid)
        {
            alerts.Add(new SriValidationAlert(
                Severity: "success",
                Code: "ACCESS_KEY_VALID",
                Title: "Clave de Acceso SRI Válida",
                Message: "Estructura de 49 dígitos y algoritmo Módulo 11 verificados correctamente."));
        }
        else
        {
            alerts.Add(new SriValidationAlert(
                Severity: "danger",
                Code: "ACCESS_KEY_INVALID",
                Title: "Clave de Acceso con Inconsistencia",
                Message: keyError ?? "Error en la clave de acceso de la factura.",
                Recommendation: "Verifique si el XML fue alterado o solicite al proveedor el comprobante original emitido."));
        }

        // 2. Ambiente SRI (1 = Pruebas, 2 = Producción)
        var root = xmlDoc.Root;
        var infoTrib = root?.DescendantsAndSelf().FirstOrDefault(e => e.Name.LocalName.Equals("infoTributaria", StringComparison.OrdinalIgnoreCase));
        var ambienteElem = infoTrib?.Elements().FirstOrDefault(e => e.Name.LocalName.Equals("ambiente", StringComparison.OrdinalIgnoreCase));
        var ambienteVal = ambienteElem?.Value?.Trim() ?? "2";
        string envName = ambienteVal == "1" ? "PRUEBAS" : "PRODUCCION";

        if (ambienteVal == "1")
        {
            alerts.Add(new SriValidationAlert(
                Severity: "danger",
                Code: "TEST_ENVIRONMENT",
                Title: "Comprobante en Ambiente de PRUEBAS",
                Message: "El comprobante fue generado en el ambiente de pruebas del SRI (Ambiente 1). Carece de validez legal y tributaria para respaldar compras.",
                Recommendation: "Solicite a su proveedor la emisión de la factura en el ambiente de Producción (Ambiente 2)."));
        }

        // 3. Contenedor de Autorización SRI y Contingencia
        var estadoElem = root?.DescendantsAndSelf().FirstOrDefault(e => e.Name.LocalName.Equals("estado", StringComparison.OrdinalIgnoreCase));
        var estadoVal = estadoElem?.Value?.Trim()?.ToUpperInvariant();

        var fechaAuthElem = root?.DescendantsAndSelf().FirstOrDefault(e => e.Name.LocalName.Equals("fechaAutorizacion", StringComparison.OrdinalIgnoreCase));
        DateTimeOffset? authDate = null;
        if (!string.IsNullOrWhiteSpace(fechaAuthElem?.Value))
        {
            if (DateTimeOffset.TryParse(fechaAuthElem.Value.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var dtParsed))
            {
                authDate = dtParsed;
            }
        }

        bool isSriAuthorized = false;
        string finalSriStatus;

        if (estadoVal == "AUTORIZADO")
        {
            isSriAuthorized = true;
            finalSriStatus = "AUTORIZADO";
            alerts.Add(new SriValidationAlert(
                Severity: "success",
                Code: "SRI_AUTHORIZED",
                Title: "Comprobante Autorizado por el SRI",
                Message: $"Factura autorizada oficialmente por el SRI con autorización N° {authorizationNumber ?? accessKey}.",
                Recommendation: null));
        }
        else if (estadoVal == "EN PROCESO" || estadoVal == "PENDIENTE")
        {
            finalSriStatus = estadoVal;
            alerts.Add(new SriValidationAlert(
                Severity: "warning",
                Code: "SRI_PENDING_AUTHORIZATION",
                Title: "Comprobante en Proceso en el SRI",
                Message: "El comprobante está registrado en el SRI pero aún figura en estado 'EN PROCESO' o 'PENDIENTE'. Esto ocurre habitualmente por demoras en los WebServices del SRI.",
                Recommendation: "Puede registrar la compra de forma preventiva; confirme en el portal del SRI que cambie a 'AUTORIZADO' antes del cierre de mes fiscal."));
        }
        else if (estadoVal == "NO AUTORIZADO" || estadoVal == "DEVUELTA" || estadoVal == "RECHAZADO")
        {
            finalSriStatus = estadoVal;
            alerts.Add(new SriValidationAlert(
                Severity: "danger",
                Code: "SRI_REJECTED",
                Title: $"Comprobante {estadoVal} por el SRI",
                Message: $"El SRI devolvió o rechazó este comprobante ({estadoVal}). No surte efectos tributarios para crédito de IVA o costo deducible.",
                Recommendation: "Rechace esta factura y exija a su proveedor corregir la causa de rechazo informada por el SRI y emitir una nueva factura."));
        }
        else
        {
            // El XML no vino con nodo <autorizacion> ni <estado> (es XML de factura cruda o contingencia offline)
            finalSriStatus = "SIN_CONTENEDOR_SRI";
            alerts.Add(new SriValidationAlert(
                Severity: "warning",
                Code: "NO_SRI_CONTAINER",
                Title: "XML sin contenedor de Autorización SRI (Contingencia / Factura Cruda)",
                Message: "El archivo cargado es el XML de la factura firmada por el emisor, pero no contiene la respuesta oficial de autorización del SRI. Esto sucede cuando el proveedor descarga el comprobante mientras el SRI está caído o antes de la sincronización.",
                Recommendation: "Puede guardarla en estado Borrador; se recomienda consultar la clave de 49 dígitos en el portal del SRI para asegurar su autorización definitiva."));
        }

        // 4. Consistencia Matemática y Aritmética
        decimal calculatedTotal = Math.Round(subtotalZero + subtotalTaxed + subtotalNoSubject + subtotalExempt + taxAmount - totalDiscount, 2, MidpointRounding.AwayFromZero);
        decimal mathDiscrepancy = Math.Round(Math.Abs(calculatedTotal - totalAmount), 2, MidpointRounding.AwayFromZero);
        bool isMathConsistent = mathDiscrepancy <= 0.05m;

        if (!isMathConsistent)
        {
            alerts.Add(new SriValidationAlert(
                Severity: "danger",
                Code: "MATH_TOTAL_MISMATCH",
                Title: "Inconsistencia Aritmética en Importe Total",
                Message: $"La suma calculada de bases ($ {subtotalZero + subtotalTaxed + subtotalNoSubject + subtotalExempt:F2}) + IVA ($ {taxAmount:F2}) - Descuento ($ {totalDiscount:F2}) resulta en $ {calculatedTotal:F2}, pero el Total declarado en la cabecera es $ {totalAmount:F2} (diferencia: $ {mathDiscrepancy:F2}).",
                Recommendation: "Revise los ítems y consulte con el emisor; una factura con totales inconsistentes puede ser observada en el ATS o auditorías del SRI."));
        }
        else
        {
            alerts.Add(new SriValidationAlert(
                Severity: "success",
                Code: "MATH_TOTAL_VALID",
                Title: "Coherencia Aritmética Cuadrada",
                Message: $"Las bases imponibles e impuestos suman exactamente $ {calculatedTotal:F2}, coincidiendo con el total de $ {totalAmount:F2}."));
        }

        // 5. Verificación de Tarifa IVA Vigente (15% en Ecuador desde 01/04/2024)
        string taxRateStatus;
        if (taxRate == 15m)
        {
            taxRateStatus = "VIGENTE_15";
            alerts.Add(new SriValidationAlert(
                Severity: "success",
                Code: "TAX_RATE_CURRENT_15",
                Title: "Tarifa IVA Vigente (15%)",
                Message: "La factura aplica la tarifa general de IVA del 15% vigente en Ecuador."));
        }
        else if (taxRate == 5m)
        {
            taxRateStatus = "REDUCIDA_CONSTRUCCION_5";
            alerts.Add(new SriValidationAlert(
                Severity: "info",
                Code: "TAX_RATE_REDUCED_5",
                Title: "Tarifa IVA Reducida (5% Construcción)",
                Message: "La factura aplica tarifa reducida del 5% para materiales de construcción y vivienda de interés social."));
        }
        else if (taxRate == 0m)
        {
            taxRateStatus = "TARIFA_CERO";
            alerts.Add(new SriValidationAlert(
                Severity: "info",
                Code: "TAX_RATE_ZERO",
                Title: "Tarifa IVA 0%",
                Message: "La compra está exenta o gravada con tarifa 0% según normativa tributaria."));
        }
        else if (issueDate >= Vat15StartDate && (taxRate == 12m || taxRate == 14m))
        {
            taxRateStatus = taxRate == 12m ? "OBSOLETA_12" : "OBSOLETA_14";
            alerts.Add(new SriValidationAlert(
                Severity: "warning",
                Code: "TAX_RATE_OBSOLETE",
                Title: $"Tarifa IVA Desfasada ({taxRate}%)",
                Message: $"La factura tiene fecha de emisión posterior a abril de 2024 ({issueDate:dd/MM/yyyy}), pero aplica una tarifa del {taxRate}% (cuando la general es 15%).",
                Recommendation: "Consulte al proveedor si corresponde a un régimen transitorio especial o si debe refacturar con tarifa del 15%."));
        }
        else
        {
            taxRateStatus = "OTRA";
        }

        // 6. Estado General Global
        string overallStatus;
        if (alerts.Any(a => a.Severity == "danger"))
        {
            overallStatus = "danger";
        }
        else if (alerts.Any(a => a.Severity == "warning"))
        {
            overallStatus = "warning";
        }
        else
        {
            overallStatus = "valid";
        }

        return new SriValidationReport(
            OverallStatus: overallStatus,
            IsAuthorizedBySri: isSriAuthorized,
            SriStatus: finalSriStatus,
            SriAuthorizationDate: authDate,
            Environment: envName,
            IsAccessKeyValid: isKeyValid,
            AccessKeyCheckDigitExpected: expectedCheckStr,
            IsMathConsistent: isMathConsistent,
            CalculatedTotal: calculatedTotal,
            DeclaredTotal: totalAmount,
            MathDiscrepancy: mathDiscrepancy,
            TaxRateStatus: taxRateStatus,
            Alerts: alerts.AsReadOnly()
        );
    }
}
