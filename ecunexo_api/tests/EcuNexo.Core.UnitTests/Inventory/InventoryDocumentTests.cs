using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;

namespace EcuNexo.Core.UnitTests.Inventory;

/// <summary>
/// Prioridad 2 — Ciclo de vida del documento: recepción/egreso y transferencia (ADR-010).
/// </summary>
public sealed class InventoryDocumentTests
{
    private static readonly Guid TenantId = Guid.CreateVersion7();
    private static readonly Guid OriginId = Guid.CreateVersion7();
    private static readonly Guid DestinationId = Guid.CreateVersion7();
    private static readonly Guid ItemId = Guid.CreateVersion7();

    [Fact(DisplayName = "Recepción en borrador se aprueba y queda Approved")]
    public void MarkApproved_ReceiptDraft_Succeeds()
    {
        // Preparar
        var document = CreateReceipt().Value!;

        // Actuar
        var result = document.MarkApproved(DateTimeOffset.UtcNow, approvedBy: null);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        document.Status.Should().Be(InventoryDocumentStatus.Approved);
        document.ApprovedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "No se puede aprobar dos veces el mismo documento")]
    public void MarkApproved_AlreadyApproved_ReturnsConflict()
    {
        // Preparar
        var document = CreateReceipt().Value!;
        document.MarkApproved(DateTimeOffset.UtcNow, null).IsSuccess.Should().BeTrue();

        // Actuar
        var result = document.MarkApproved(DateTimeOffset.UtcNow, null);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.document.approve.state");
    }

    [Fact(DisplayName = "Transferencia exige bodega destino distinta")]
    public void Create_TransferSameWarehouse_ReturnsValidationError()
    {
        // Preparar / Actuar
        var result = InventoryDocument.Create(
            Guid.CreateVersion7(),
            TenantId,
            InventoryDocumentType.Transfer,
            OriginId,
            notes: null,
            lines: [(Guid.CreateVersion7(), ItemId, 2m)],
            destinationWarehouseId: OriginId);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.document.transfer.same_warehouse");
    }

    [Fact(DisplayName = "Transferencia: Draft → InTransit → Approved")]
    public void Transfer_ShipThenReceive_CompletesLifecycle()
    {
        // Preparar
        var document = CreateTransfer().Value!;

        // Actuar — despacho a tránsito
        var shipped = document.MarkShipped(DateTimeOffset.UtcNow, shippedBy: null);
        // Actuar — recepción en destino
        var received = document.MarkReceived(DateTimeOffset.UtcNow, receivedBy: null);

        // Verificar
        shipped.IsSuccess.Should().BeTrue();
        received.IsSuccess.Should().BeTrue();
        document.Status.Should().Be(InventoryDocumentStatus.Approved);
        document.ShippedAt.Should().NotBeNull();
        document.ApprovedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "No se recibe una transferencia que aún está en borrador")]
    public void MarkReceived_WhileDraft_ReturnsConflict()
    {
        // Preparar
        var document = CreateTransfer().Value!;

        // Actuar
        var result = document.MarkReceived(DateTimeOffset.UtcNow, null);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.document.receive.state");
    }

    [Fact(DisplayName = "Documento en tránsito no se cancela (exige reversión)")]
    public void Cancel_InTransit_ReturnsConflict()
    {
        // Preparar
        var document = CreateTransfer().Value!;
        document.MarkShipped(DateTimeOffset.UtcNow, null).IsSuccess.Should().BeTrue();

        // Actuar
        var result = document.Cancel(updatedBy: null);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.document.cancel.posted");
    }

    [Fact(DisplayName = "Ajuste sin nota de motivo se rechaza")]
    public void Create_AdjustmentWithoutNotes_ReturnsValidationError()
    {
        // Preparar / Actuar
        var result = InventoryDocument.Create(
            Guid.CreateVersion7(),
            TenantId,
            InventoryDocumentType.Adjustment,
            OriginId,
            notes: null,
            lines: [(Guid.CreateVersion7(), ItemId, 0m)]);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.document.adjustment.notes.required");
    }

    [Fact(DisplayName = "Recepción por compra exige número de factura")]
    public void Create_PurchaseReceiptWithoutNumber_ReturnsValidationError()
    {
        var result = InventoryDocument.Create(
            Guid.CreateVersion7(),
            TenantId,
            InventoryDocumentType.Receipt,
            OriginId,
            notes: null,
            lines: [(Guid.CreateVersion7(), ItemId, 5m)],
            receiptOrigin: InventoryReceiptOrigin.Purchase);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.document.purchase.number.required");
    }

    [Fact(DisplayName = "Recepción por compra con factura 001-001-000000123 se acepta")]
    public void Create_PurchaseReceiptWithInvoiceNumber_Succeeds()
    {
        var result = InventoryDocument.Create(
            Guid.CreateVersion7(),
            TenantId,
            InventoryDocumentType.Receipt,
            OriginId,
            notes: null,
            lines: [(Guid.CreateVersion7(), ItemId, 5m)],
            receiptOrigin: InventoryReceiptOrigin.Purchase,
            sourceDocumentNumber: "001-001-000000123");

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        result.Value!.ReceiptOrigin.Should().Be(InventoryReceiptOrigin.Purchase);
        result.Value.SourceDocumentNumber.Should().Be("001-001-000000123");
    }

    [Fact(DisplayName = "Recepción sin origen queda como inventario inicial")]
    public void Create_ReceiptWithoutOrigin_DefaultsToOpening()
    {
        var result = CreateReceipt();

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        result.Value!.ReceiptOrigin.Should().Be(InventoryReceiptOrigin.Opening);
        result.Value.SourceDocumentNumber.Should().BeNull();
    }

    [Fact(DisplayName = "Transferencia no admite origen de recepción")]
    public void Create_TransferWithReceiptOrigin_ReturnsValidationError()
    {
        var result = InventoryDocument.Create(
            Guid.CreateVersion7(),
            TenantId,
            InventoryDocumentType.Transfer,
            OriginId,
            notes: null,
            lines: [(Guid.CreateVersion7(), ItemId, 1m)],
            destinationWarehouseId: DestinationId,
            receiptOrigin: InventoryReceiptOrigin.Opening);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.document.origin.not_allowed");
    }

    [Fact(DisplayName = "Ajuste admite cantidad contada en cero")]
    public void Create_AdjustmentWithZeroCount_Succeeds()
    {
        // Preparar / Actuar
        var result = InventoryDocument.Create(
            Guid.CreateVersion7(),
            TenantId,
            InventoryDocumentType.Adjustment,
            OriginId,
            notes: "Conteo físico vacío",
            lines: [(Guid.CreateVersion7(), ItemId, 0m)]);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        result.Value!.Lines[0].Quantity.Should().Be(0m);
        result.Value.DocumentType.Should().Be(InventoryDocumentType.Adjustment);
    }

    private static Result<InventoryDocument> CreateReceipt() =>
        InventoryDocument.Create(
            Guid.CreateVersion7(),
            TenantId,
            InventoryDocumentType.Receipt,
            OriginId,
            notes: "Entrada inicial",
            lines: [(Guid.CreateVersion7(), ItemId, 5m)]);

    private static Result<InventoryDocument> CreateTransfer() =>
        InventoryDocument.Create(
            Guid.CreateVersion7(),
            TenantId,
            InventoryDocumentType.Transfer,
            OriginId,
            notes: "Traspaso A→B",
            lines: [(Guid.CreateVersion7(), ItemId, 3m)],
            destinationWarehouseId: DestinationId);
}
