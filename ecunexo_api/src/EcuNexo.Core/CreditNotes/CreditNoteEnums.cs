namespace EcuNexo.Core.CreditNotes;

/// <summary>
/// Estado del flujo de vida de la Nota de Crédito Electrónica.
/// </summary>
public enum CreditNoteStatus
{
    /// <summary>
    /// Borrador local no transmitido.
    /// </summary>
    Draft = 0,

    /// <summary>
    /// Generado y firmado XAdES-BES, transmitido o en procesamiento por el SRI.
    /// </summary>
    Issued = 1,

    /// <summary>
    /// Autorizado legalmente por el SRI.
    /// </summary>
    Authorized = 2,

    /// <summary>
    /// Rechazado / Devuelto por el SRI con errores.
    /// </summary>
    Rejected = 3,

    /// <summary>
    /// Anulado administrativamente.
    /// </summary>
    Cancelled = 4
}

/// <summary>
/// Motivo / Clasificación operativa de la Nota de Crédito.
/// </summary>
public enum CreditNoteReasonType
{
    /// <summary>
    /// Devolución física de mercadería (afecta Kárdex de inventario y A/R).
    /// </summary>
    MerchandiseReturn = 0,

    /// <summary>
    /// Ajuste de precio o descuento concedido a posteriori (afecta solo A/R y contabilidad).
    /// </summary>
    PriceAdjustment = 1,

    /// <summary>
    /// Anulación total del comprobante sustento por rescisión o error.
    /// </summary>
    ContractCancellation = 2,

    /// <summary>
    /// Corrección de datos o ajuste tributario.
    /// </summary>
    Correction = 3
}
