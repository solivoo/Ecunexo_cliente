namespace EcuNexo.Core.Accounting;

/// <summary>
/// Origen del asiento contable en el sistema.
/// </summary>
public enum JournalEntrySource
{
    Manual = 1,             // Asiento manual ingresado por la contadora o administración
    SalesInvoice = 2,       // Factura electrónica de venta emitida
    PurchaseInvoice = 3,    // Factura electrónica de compra recibida
    PurchaseSettlement = 4, // Liquidación de compra (SRI Tipo 03) emitida
    InventoryReceipt = 5,   // Ingreso físico a bodega / recepción de existencias
    InventoryDispatch = 6,  // Despacho de inventario / costo de venta
    PaymentReceipt = 7,     // Cobro de factura
    SupplierPayment = 8     // Pago a proveedor
}

/// <summary>
/// Estado del asiento contable en el Libro Diario.
/// </summary>
public enum JournalEntryStatus
{
    Draft = 1,      // Borrador / pendiente de contabilizar
    Posted = 2,     // Contabilizado (afecta mayores y balances)
    Cancelled = 3   // Anulado
}
