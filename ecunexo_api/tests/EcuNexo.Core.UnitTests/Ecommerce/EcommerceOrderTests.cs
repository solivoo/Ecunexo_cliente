using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Core.UnitTests.Ecommerce;

public sealed class EcommerceOrderTests
{
    private static (EcommerceCustomerInfo Customer, EcommerceShippingInfo Shipping) CreateSampleInfo()
    {
        var customer = new EcommerceCustomerInfo(
            CustomerName: "Juan Pérez",
            TaxId: "0921234567",
            TaxIdType: "05",
            Email: "juan.perez@example.com",
            Phone: "0991234567",
            Address: "Av. 9 de Octubre 100 y Malecón");

        var shipping = new EcommerceShippingInfo(
            RecipientName: "Juan Pérez",
            RecipientPhone: "0991234567",
            AddressLine1: "Calle Las Monjas 123",
            AddressLine2: "Dpto 4B",
            City: "Guayaquil",
            Province: "Guayas",
            PostalCode: "090150",
            Carrier: null,
            TrackingNumber: null,
            Notes: "Dejar en garita si no responde");

        return (customer, shipping);
    }

    [Fact(DisplayName = "Create genera orden en estado Placed con timeline inicial")]
    public void Create_ValidParameters_SetsInitialState()
    {
        var (customer, shipping) = CreateSampleInfo();
        var orderId = Guid.CreateVersion7();
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();

        var result = EcommerceOrder.Create(
            orderId,
            tenantId,
            orderNumber: "ORD-2026-001",
            warehouseId,
            paymentMethod: EcommercePaymentMethod.BankTransfer,
            shippingMethod: EcommerceShippingMethod.Courier,
            customer,
            shipping,
            shippingCost: 5m,
            internalNotes: "Primer pedido del cliente");

        result.IsSuccess.Should().BeTrue();
        var order = result.Value!;
        order.Id.Should().Be(orderId);
        order.Status.Should().Be(EcommerceOrderStatus.Placed);
        order.PaymentStatus.Should().Be(EcommercePaymentStatus.Pending);
        order.ShippingCost.Should().Be(5m);
        order.Timeline.Should().ContainSingle(t => t.NewStatus == EcommerceOrderStatus.Placed);
    }

    [Fact(DisplayName = "AddItem calcula totales y subtotales correctamente")]
    public void AddItem_RecalculatesTotals()
    {
        var (customer, shipping) = CreateSampleInfo();
        var order = EcommerceOrder.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "ORD-2026-002",
            Guid.CreateVersion7(),
            EcommercePaymentMethod.CreditCard,
            EcommerceShippingMethod.Courier,
            customer,
            shipping,
            shippingCost: 4.5m).Value!;

        var item1 = EcommerceOrderItem.Create(
            Guid.CreateVersion7(),
            order.Id,
            Guid.CreateVersion7(),
            sku: "SKU-001",
            itemName: "Laptop Asus ROG",
            quantity: 1m,
            unitPrice: 1000m,
            discountAmount: 100m,
            taxRate: 0.15m).Value!; // Subtotal 900, IVA 135

        var item2 = EcommerceOrderItem.Create(
            Guid.CreateVersion7(),
            order.Id,
            Guid.CreateVersion7(),
            sku: "SKU-002",
            itemName: "Mouse Logitech",
            quantity: 2m,
            unitPrice: 50m,
            discountAmount: 0m,
            taxRate: 0.15m).Value!; // Subtotal 100, IVA 15

        order.AddItem(item1).IsSuccess.Should().BeTrue();
        order.AddItem(item2).IsSuccess.Should().BeTrue();

        order.Subtotal.Should().Be(1000m); // 900 + 100
        order.DiscountAmount.Should().Be(100m);
        order.TaxAmount.Should().Be(150m); // 135 + 15
        order.ShippingCost.Should().Be(4.5m);
        order.TotalAmount.Should().Be(1154.5m); // 1000 + 150 + 4.5
    }

    [Fact(DisplayName = "Flujo completo: Placed -> Confirmed -> Processing -> Shipped -> Delivered")]
    public void FullOrderLifecycle_SucceedsWithTimelineEvents()
    {
        var (customer, shipping) = CreateSampleInfo();
        var order = EcommerceOrder.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "ORD-2026-003",
            Guid.CreateVersion7(),
            EcommercePaymentMethod.BankTransfer,
            EcommerceShippingMethod.Courier,
            customer,
            shipping).Value!;

        // 1. Confirmar pago
        var payResult = order.ConfirmPayment("TRF-987654", null, "Admin");
        payResult.IsSuccess.Should().BeTrue();
        order.Status.Should().Be(EcommerceOrderStatus.Confirmed);
        order.PaymentStatus.Should().Be(EcommercePaymentStatus.Paid);

        // 2. Pasar a preparación
        var procResult = order.MarkProcessing(null, "Bodeguero");
        procResult.IsSuccess.Should().BeTrue();
        order.Status.Should().Be(EcommerceOrderStatus.Processing);

        // 3. Despachar con courier y guía
        var shipResult = order.MarkShipped("Servientrega", "GUIA-12345678", null, "Despachador");
        shipResult.IsSuccess.Should().BeTrue();
        order.Status.Should().Be(EcommerceOrderStatus.Shipped);
        order.Shipping.Carrier.Should().Be("Servientrega");
        order.Shipping.TrackingNumber.Should().Be("GUIA-12345678");
        order.ShippedAt.Should().NotBeNull();

        // 4. Entregar al cliente
        var delivResult = order.MarkDelivered(null, "Repartidor");
        delivResult.IsSuccess.Should().BeTrue();
        order.Status.Should().Be(EcommerceOrderStatus.Delivered);
        order.DeliveredAt.Should().NotBeNull();

        // 5. Vincular factura electrónica SRI
        var invoiceId = Guid.CreateVersion7();
        var invResult = order.LinkBillingInvoice(invoiceId, null);
        invResult.IsSuccess.Should().BeTrue();
        order.BillingInvoiceId.Should().Be(invoiceId);

        order.Timeline.Count.Should().Be(6); // Placed + Confirmed + Processing + Shipped + Delivered + Invoiced
    }

    [Fact(DisplayName = "Cancel no permite anular órdenes ya despachadas")]
    public void Cancel_WhenAlreadyShipped_ReturnsConflict()
    {
        var (customer, shipping) = CreateSampleInfo();
        var order = EcommerceOrder.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "ORD-2026-004",
            Guid.CreateVersion7(),
            EcommercePaymentMethod.CreditCard,
            EcommerceShippingMethod.Courier,
            customer,
            shipping).Value!;

        order.ConfirmPayment("AUTH-123", null, "Admin");
        order.MarkShipped("Urbano", "URB-111", null, "Admin");

        var cancelResult = order.Cancel("Cliente desistió", null, "Admin");

        cancelResult.IsFailure.Should().BeTrue();
        cancelResult.Error!.Code.Should().Be("ecommerce.order.cannot_cancel_shipped");
    }

    [Fact(DisplayName = "Cancel en estado Placed anula la orden y registra motivo")]
    public void Cancel_WhenPlaced_Succeeds()
    {
        var (customer, shipping) = CreateSampleInfo();
        var order = EcommerceOrder.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "ORD-2026-005",
            Guid.CreateVersion7(),
            EcommercePaymentMethod.BankTransfer,
            EcommerceShippingMethod.Courier,
            customer,
            shipping).Value!;

        var cancelResult = order.Cancel("No transfirió comprobante en 24h", null, "Sistema");

        cancelResult.IsSuccess.Should().BeTrue();
        order.Status.Should().Be(EcommerceOrderStatus.Cancelled);
        order.CancellationReason.Should().Be("No transfirió comprobante en 24h");
        order.CancelledAt.Should().NotBeNull();
    }
}
