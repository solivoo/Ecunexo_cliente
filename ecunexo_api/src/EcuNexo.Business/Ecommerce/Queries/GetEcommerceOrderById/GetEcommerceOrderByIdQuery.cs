using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Dtos;

namespace EcuNexo.Business.Ecommerce.Queries.GetEcommerceOrderById;

public sealed record GetEcommerceOrderByIdQuery(
    Guid TenantId,
    Guid OrderId) : IQuery<EcommerceOrderDetailDto>;
