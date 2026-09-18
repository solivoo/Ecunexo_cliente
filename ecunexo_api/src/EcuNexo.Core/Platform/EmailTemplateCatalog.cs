namespace EcuNexo.Core.Platform;

public sealed record SystemEmailTemplate(
    string ActionCode,
    string ActionName,
    string Description,
    string DefaultSubject,
    string DefaultBodyHtml,
    IReadOnlyList<string> AvailablePlaceholders);

public static class EmailTemplateCatalog
{
    public const string SettingPrefix = "system.email.template.";

    public static string GetSettingCode(string actionCode) => $"{SettingPrefix}{actionCode.Trim().ToLowerInvariant()}";

    public static readonly IReadOnlyList<SystemEmailTemplate> DefaultTemplates = new SystemEmailTemplate[]
    {
        new(
            "sri.invoice.authorized",
            "Factura Electrónica SRI Autorizada",
            "Notificación enviada al cliente en cuanto el SRI autoriza la factura con comprobantes XML y RIDE PDF.",
            "Factura Electrónica {{FacturaNumero}} — {{TenantName}}",
            @"<div style=""font-family: system-ui, -apple-system, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;"">
    <div style=""text-align: center; padding-bottom: 16px; border-bottom: 2px solid #6366f1;"">
        <h2 style=""color: #1e1b4b; margin: 0;"">{{TenantName}}</h2>
        <p style=""color: #64748b; font-size: 13px; margin: 4px 0 0 0;"">RUC: {{TenantRuc}} · Facturación Electrónica SRI</p>
    </div>
    <div style=""padding: 20px 0;"">
        <p style=""font-size: 15px; color: #334155;"">Estimado/a <strong>{{ClienteNombre}}</strong>,</p>
        <p style=""font-size: 14px; color: #475569; line-height: 1.6;"">
            Le informamos que se ha generado y autorizado su comprobante electrónico de venta con los siguientes detalles:
        </p>
        <div style=""background: #f8fafc; border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 6px; margin: 16px 0;"">
            <p style=""margin: 3px 0; font-size: 14px; color: #1e293b;""><strong>N° Factura:</strong> {{FacturaNumero}}</p>
            <p style=""margin: 3px 0; font-size: 14px; color: #1e293b;""><strong>Monto Total:</strong> ${{MontoTotal}}</p>
            <p style=""margin: 3px 0; font-size: 14px; color: #1e293b;""><strong>Fecha de Emisión:</strong> {{FechaEmision}}</p>
            <p style=""margin: 3px 0; font-size: 12px; color: #64748b; font-family: monospace; word-break: break-all;""><strong>Clave Acceso SRI:</strong> {{ClaveAcceso}}</p>
        </div>
        <p style=""font-size: 13px; color: #64748b;"">Adjunto a este correo encontrará su archivo XML firmado digitalmente y la representación gráfica RIDE en formato PDF.</p>
    </div>
    <div style=""text-align: center; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;"">
        <p style=""margin: 0;"">Generado automáticamente por EcuNexo · Sistema de Gestión Empresarial</p>
    </div>
</div>",
            new[] { "{{ClienteNombre}}", "{{FacturaNumero}}", "{{MontoTotal}}", "{{FechaEmision}}", "{{ClaveAcceso}}", "{{TenantName}}", "{{TenantRuc}}" }
        ),
        new(
            "purchases.proforma.awarded",
            "Adjudicación de Cotización / Proforma",
            "Notificación enviada al proveedor al adjudicar una proforma comercial.",
            "Adjudicación de Proforma N° {{ProformaNumero}} — {{TenantName}}",
            @"<div style=""font-family: system-ui, -apple-system, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;"">
    <div style=""text-align: center; padding-bottom: 16px; border-bottom: 2px solid #10b981;"">
        <h2 style=""color: #064e3b; margin: 0;"">{{TenantName}}</h2>
        <p style=""color: #64748b; font-size: 13px; margin: 4px 0 0 0;"">Gestión de Compras y Abastecimiento</p>
    </div>
    <div style=""padding: 20px 0;"">
        <p style=""font-size: 15px; color: #334155;"">Estimados <strong>{{ProveedorNombre}}</strong>,</p>
        <p style=""font-size: 14px; color: #475569; line-height: 1.6;"">
            Nos complace informarles que su cotización N° <strong>{{ProformaNumero}}</strong> ha sido adjudicada y aprobada para procesamiento.
        </p>
        <div style=""background: #f0fdf4; border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 6px; margin: 16px 0;"">
            <p style=""margin: 3px 0; font-size: 14px; color: #065f46;""><strong>Proforma:</strong> {{ProformaNumero}}</p>
            <p style=""margin: 3px 0; font-size: 14px; color: #065f46;""><strong>Monto Adjudicado:</strong> ${{MontoTotal}}</p>
            <p style=""margin: 3px 0; font-size: 14px; color: #065f46;""><strong>Fecha de Aprobación:</strong> {{FechaAdjudicacion}}</p>
        </div>
        <p style=""font-size: 13px; color: #64748b;"">Nuestro departamento de compras se pondrá en contacto para la emisión de la orden formal.</p>
    </div>
</div>",
            new[] { "{{ProveedorNombre}}", "{{ProformaNumero}}", "{{MontoTotal}}", "{{FechaAdjudicacion}}", "{{TenantName}}" }
        ),
        new(
            "repairs.equipment.dispatched",
            "Equipo Listo para Entrega / Taller",
            "Notificación enviada al cliente cuando su equipo completa la fase de QC / Reparación y queda listo para retiro.",
            "Equipo {{EquipoModelo}} listo para entrega — Orden {{OrdenNumero}}",
            @"<div style=""font-family: system-ui, -apple-system, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;"">
    <div style=""text-align: center; padding-bottom: 16px; border-bottom: 2px solid #8b5cf6;"">
        <h2 style=""color: #4c1d95; margin: 0;"">{{TenantName}}</h2>
        <p style=""color: #64748b; font-size: 13px; margin: 4px 0 0 0;"">Centro de Servicio Técnico y Taller</p>
    </div>
    <div style=""padding: 20px 0;"">
        <p style=""font-size: 15px; color: #334155;"">Estimado/a <strong>{{ClienteNombre}}</strong>,</p>
        <p style=""font-size: 14px; color: #475569; line-height: 1.6;"">
            Su equipo ha finalizado la fase de control de calidad y se encuentra listo para entrega en nuestras instalaciones.
        </p>
        <div style=""background: #f5f3ff; border-left: 4px solid #8b5cf6; padding: 14px 18px; border-radius: 6px; margin: 16px 0;"">
            <p style=""margin: 3px 0; font-size: 14px; color: #5b21b6;""><strong>Orden de Trabajo:</strong> {{OrdenNumero}}</p>
            <p style=""margin: 3px 0; font-size: 14px; color: #5b21b6;""><strong>Equipo:</strong> {{EquipoModelo}} (N° Serie: {{SerieNumber}})</p>
            <p style=""margin: 3px 0; font-size: 14px; color: #5b21b6;""><strong>Estado:</strong> {{EstadoFinal}}</p>
        </div>
    </div>
</div>",
            new[] { "{{ClienteNombre}}", "{{OrdenNumero}}", "{{EquipoModelo}}", "{{SerieNumber}}", "{{EstadoFinal}}", "{{TenantName}}" }
        ),
        new(
            "auth.user_welcome",
            "Bienvenida e Invitación a Usuario",
            "Correo enviado al dar de alta un nuevo usuario operador en la plataforma.",
            "Bienvenido/a a {{TenantName}} en EcuNexo",
            @"<div style=""font-family: system-ui, -apple-system, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;"">
    <h2 style=""color: #3525cd; margin-top: 0;"">¡Bienvenido/a a {{TenantName}}!</h2>
    <p style=""font-size: 15px; color: #334155;"">Hola <strong>{{UsuarioNombre}}</strong>,</p>
    <p style=""font-size: 14px; color: #475569; line-height: 1.6;"">Se ha creado tu cuenta de acceso a la plataforma EcuNexo.</p>
    <div style=""background: #f8fafc; padding: 14px 18px; border-radius: 6px; margin: 16px 0;"">
        <p style=""margin: 3px 0; font-size: 14px; color: #1e293b;""><strong>Acceso:</strong> {{LoginUrl}}</p>
    </div>
</div>",
            new[] { "{{UsuarioNombre}}", "{{TenantName}}", "{{LoginUrl}}" }
        )
    };

    public static SystemEmailTemplate? GetByCode(string actionCode)
    {
        var norm = actionCode.Trim().ToLowerInvariant();
        return Array.Find((SystemEmailTemplate[])DefaultTemplates, t => t.ActionCode == norm);
    }
}
