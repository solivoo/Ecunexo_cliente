using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Dtos;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Queries.GetEcommerceOrderById;

public sealed class GetEcommerceOrderByIdHandler
    : IQueryHandler<GetEcommerceOrderByIdQuery, EcommerceOrderDetailDto>
{
    private readonly IEcommerceOrderRepository _orders;

    public GetEcommerceOrderByIdHandler(IEcommerceOrderRepository orders)
    {
        _orders = orders;
    }

    public async Task<Result<EcommerceOrderDetailDto>> Handle(
        GetEcommerceOrderByIdQuery query,
        CancellationToken ct)
    {
        if (query.OrderId == Guid.Empty)
        {
            return Result.Failure<EcommerceOrderDetailDto>(
                new Error("ecommerce.order.id_empty", "El id de la orden es obligatorio.", ErrorType.Validation));
        }

        var order = await _orders.GetByIdAsync(query.TenantId, query.OrderId, ct).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<EcommerceOrderDetailDto>(
                new Error("ecommerce.order.not_found", "La orden especificada no existe.", ErrorType.NotFound));
        }

        var items = order.Items.Select(i => new EcommerceOrderItemDto(
            Id: i.Id,
            CatalogItemId: i.CatalogItemId,
            Sku: i.Sku,
            ItemName: i.ItemName,
            Quantity: i.Quantity,
            UnitPrice: i.UnitPrice,
            DiscountAmount: i.DiscountAmount,
            TaxRate: i.TaxRate,
            TaxAmount: i.TaxAmount,
            TotalAmount: i.TotalAmount)).ToList();

        var timeline = order.Timeline
            .OrderBy(t => t.OccurredAt)
            .Select(t => new EcommerceOrderTimelineDto(
                Id: t.Id,
                PreviousStatus: t.PreviousStatus,
                NewStatus: t.NewStatus,
                Notes: t.Notes,
                OccurredAt: t.OccurredAt,
                UserId: t.UserId,
                UserName: t.UserName)).ToList();

        var customer = new EcommerceCustomerDto(
            CustomerName: order.Customer.CustomerName,
            TaxId: order.Customer.TaxId,
            TaxIdType: order.Customer.TaxIdType,
            Email: order.Customer.Email,
            Phone: order.Customer.Phone,
            Address: order.Customer.Address);

        var shipping = new EcommerceShippingDto(
            RecipientName: order.Shipping.RecipientName,
            RecipientPhone: order.Shipping.RecipientPhone,
            AddressLine1: order.Shipping.AddressLine1,
            AddressLine2: order.Shipping.AddressLine2,
            City: order.Shipping.City,
            Province: order.Shipping.Province,
            PostalCode: order.Shipping.PostalCode,
            Carrier: order.Shipping.Carrier,
            TrackingNumber: order.Shipping.TrackingNumber,
            Notes: order.Shipping.Notes);

        var dto = new EcommerceOrderDetailDto(
            Id: order.Id,
            TenantId: order.TenantId,
            OrderNumber: order.OrderNumber,
            WarehouseId: order.WarehouseId,
            WarehouseName: order.Warehouse?.Name,
            OrderDate: order.OrderDate,
            Status: order.Status,
            PaymentStatus: order.PaymentStatus,
            PaymentMethod: order.PaymentMethod,
            PaymentReference: order.PaymentReference,
            ShippingMethod: order.ShippingMethod,
            Customer: customer,
            Shipping: shipping,
            Subtotal: order.Subtotal,
            DiscountAmount: order.DiscountAmount,
            TaxAmount: order.TaxAmount,
            ShippingCost: order.ShippingCost,
            TotalAmount: order.TotalAmount,
            BillingInvoiceId: order.BillingInvoiceId,
            EstimatedDeliveryDate: order.EstimatedDeliveryDate,
            ShippedAt: order.ShippedAt,
            DeliveredAt: order.DeliveredAt,
            CancelledAt: order.CancelledAt,
            CancellationReason: order.CancellationReason,
            InternalNotes: order.InternalNotes,
            CustomerNotes: order.CustomerNotes,
            CreatedAt: order.CreatedAt,
            Items: items,
            Timeline: timeline);

        return dto;
    }
}
