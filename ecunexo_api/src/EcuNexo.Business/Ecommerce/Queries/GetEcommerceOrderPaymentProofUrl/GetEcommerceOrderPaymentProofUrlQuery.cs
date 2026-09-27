using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Dtos;

namespace EcuNexo.Business.Ecommerce.Queries.GetEcommerceOrderPaymentProofUrl;

public sealed record GetEcommerceOrderPaymentProofUrlQuery(Guid TenantId, Guid OrderId)
    : IQuery<EcommerceOrderPaymentProofUrlDto>;
