using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Dtos;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Queries.ListEcommerceOrders;

public sealed record ListEcommerceOrdersQuery(
    Guid TenantId,
    EcommerceOrderStatus? Status = null,
    EcommercePaymentStatus? PaymentStatus = null,
    string? Search = null,
    DateTimeOffset? FromDate = null,
    DateTimeOffset? ToDate = null,
    int PageNumber = 1,
    int PageSize = 20) : IQuery<ListEcommerceOrdersResponse>;

public sealed record ListEcommerceOrdersResponse(
    IReadOnlyList<EcommerceOrderSummaryDto> Items,
    int TotalCount,
    int PageNumber,
    int PageSize);
