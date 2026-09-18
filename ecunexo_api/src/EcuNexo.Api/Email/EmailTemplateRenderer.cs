namespace EcuNexo.Api.Email;

public static class EmailTemplateRenderer
{
    private static readonly Dictionary<string, Dictionary<string, string>> SampleDataMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sri.invoice.authorized"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["{{ClienteNombre}}"] = "Corporación Importadora Guayaquil S.A.",
            ["{{FacturaNumero}}"] = "001-002-000000534",
            ["{{MontoTotal}}"] = "1,254.80",
            ["{{FechaEmision}}"] = "18/Sep/2026",
            ["{{ClaveAcceso}}"] = "1809202601179234567800120010020000005341234567819",
            ["{{TenantName}}"] = "EcuNexo Distribuciones",
            ["{{TenantRuc}}"] = "1792345678001"
        },
        ["purchases.proforma.awarded"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["{{ProveedorNombre}}"] = "Importaciones y Suministros Cía. Ltda.",
            ["{{ProformaNumero}}"] = "PRF-2026-089",
            ["{{MontoTotal}}"] = "4,850.00",
            ["{{FechaAdjudicacion}}"] = "18/Sep/2026",
            ["{{TenantName}}"] = "EcuNexo Comercial"
        },
        ["repairs.equipment.dispatched"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["{{ClienteNombre}}"] = "Ing. Carlos Mendoza",
            ["{{OrdenNumero}}"] = "ORD-TALLER-9942",
            ["{{EquipoModelo}}"] = "Impresora Térmica POS Zebra ZD421",
            ["{{SerieNumber}}"] = "ZB-8849-QUITO",
            ["{{EstadoFinal}}"] = "Reparación Exitosa / QC Aprobado",
            ["{{TenantName}}"] = "EcuNexo Taller Técnico"
        },
        ["auth.user_welcome"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["{{UsuarioNombre}}"] = "María Fernanda López",
            ["{{TenantName}}"] = "EcuNexo Empresa",
            ["{{LoginUrl}}"] = "https://app.ecunexo.com/login"
        }
    };

    public static (string RenderedSubject, string RenderedBodyHtml) Render(
        string actionCode,
        string subjectTemplate,
        string bodyHtmlTemplate,
        IDictionary<string, string>? customData = null)
    {
        var data = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        // Incorporar valores de ejemplo si existen
        if (SampleDataMap.TryGetValue(actionCode, out var samples))
        {
            foreach (var (k, v) in samples)
            {
                data[k] = v;
            }
        }

        // Sobrescribir con variables reales si se pasaron
        if (customData is not null)
        {
            foreach (var (k, v) in customData)
            {
                var keyWithBrackets = k.StartsWith("{{", StringComparison.Ordinal) && k.EndsWith("}}", StringComparison.Ordinal) ? k : $"{{{{{k}}}}}";
                data[keyWithBrackets] = v;
            }
        }

        var renderedSubject = ReplaceTokens(subjectTemplate, data);
        var renderedBody = ReplaceTokens(bodyHtmlTemplate, data);

        return (renderedSubject, renderedBody);
    }

    private static string ReplaceTokens(string template, IDictionary<string, string> replacements)
    {
        if (string.IsNullOrWhiteSpace(template))
        {
            return string.Empty;
        }

        var result = template;
        foreach (var (key, val) in replacements)
        {
            result = result.Replace(key, val, StringComparison.OrdinalIgnoreCase);
        }

        return result;
    }
}
