namespace EcuNexo.Core.Inventory;

public enum InventoryDocumentType
{
    Receipt = 0,
    Issue = 1,
    Transfer = 2,
    /// <summary>Inventario físico: la cantidad de línea es el saldo contado; al aprobar se ajusta el delta.</summary>
    Adjustment = 3,
}

public enum InventoryDocumentStatus
{
    Draft = 0,
    Approved = 1,
    Cancelled = 2,
    /// <summary>Traspaso despachado: stock en bodega en tránsito, pendiente de recepción (ADR-010).</summary>
    InTransit = 3,
}

public enum InventoryMovementDirection
{
    In = 0,
    Out = 1,
}

/// <summary>Origen de una recepción. No aplica a egreso, traslado ni ajuste.</summary>
public enum InventoryReceiptOrigin
{
    Opening = 0,
    Purchase = 1,
    Return = 2,
    Other = 3,
}
