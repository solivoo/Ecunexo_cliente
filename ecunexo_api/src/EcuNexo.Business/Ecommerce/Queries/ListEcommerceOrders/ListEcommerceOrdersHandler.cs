using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Dtos;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Queries.ListEcommerceOrders;

public sealed class ListEcommerceOrdersHandler
    : IQueryHandler<ListEcommerceOrdersQuery, ListEcommerceOrdersResponse>
{
    private readonly IEcommerceOrderRepository _orders;

    public ListEcommerceOrdersHandler(IEcommerceOrderRepository orders)
    {
        _orders = orders;
    }

    public async Task<Result<ListEcommerceOrdersResponse>> Handle(
        ListEcommerceOrdersQuery query,
        CancellationToken ct)
    {
        var (orders, totalCount) = await _orders.ListAsync(
            query.TenantId,
            query.Status,
            query.PaymentStatus,
            query.Search,
            query.FromDate,
            query.ToDate,
            query.PageNumber,
            query.PageSize,
            ct).ConfigureAwait(false);

        var dtos = orders.Select(o => new EcommerceOrderSummaryDto(
            Id: o.Id,
            OrderNumber: o.OrderNumber,
            WarehouseId: o.WarehouseId,
            WarehouseName: o.Warehouse?.Name,
            OrderDate: o.OrderDate,
            Status: o.Status,
            PaymentStatus: o.PaymentStatus,
            PaymentMethod: o.PaymentMethod,
            PaymentReference: o.PaymentReference,
            ShippingMethod: o.ShippingMethod,
            CustomerName: o.Customer.CustomerName,
            CustomerTaxId: o.Customer.TaxId,
            CustomerEmail: o.Customer.Email,
            RecipientCity: o.Shipping.City,
            TotalAmount: o.TotalAmount,
            ItemsCount: o.Items.Count,
            BillingInvoiceId: o.BillingInvoiceId,
            CreatedAt: o.CreatedAt)).ToList();

        return new ListEcommerceOrdersResponse(
            dtos,
            totalCount,
            query.PageNumber,
            query.PageSize);
    }
}
