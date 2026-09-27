using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Dtos;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Queries.GetEcommerceOrderPaymentProofUrl;

public sealed class GetEcommerceOrderPaymentProofUrlHandler
    : IQueryHandler<GetEcommerceOrderPaymentProofUrlQuery, EcommerceOrderPaymentProofUrlDto>
{
    private const int DownloadUrlExpiresInMinutes = 15;

    private readonly IEcommerceOrderRepository _orders;
    private readonly IStorageService _storage;

    public GetEcommerceOrderPaymentProofUrlHandler(
        IEcommerceOrderRepository orders,
        IStorageService storage)
    {
        _orders = orders;
        _storage = storage;
    }

    public async Task<Result<EcommerceOrderPaymentProofUrlDto>> Handle(
        GetEcommerceOrderPaymentProofUrlQuery query,
        CancellationToken ct)
    {
        var order = await _orders
            .GetByIdAsync(query.TenantId, query.OrderId, ct)
            .ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<EcommerceOrderPaymentProofUrlDto>(new Error(
                "ecommerce.order.not_found",
                "La orden especificada no existe.",
                ErrorType.NotFound));
        }

        if (string.IsNullOrWhiteSpace(order.PaymentProofObjectKey))
        {
            return Result.Failure<EcommerceOrderPaymentProofUrlDto>(new Error(
                "ecommerce.order.payment_proof_not_found",
                "El pedido todavía no tiene comprobante de pago.",
                ErrorType.NotFound));
        }

        var url = _storage.GetPresignedDownloadUrl(
            _storage.PrivateBucket,
            order.PaymentProofObjectKey,
            DownloadUrlExpiresInMinutes);

        return Result.Success(new EcommerceOrderPaymentProofUrlDto(
            url,
            order.PaymentProofUploadedAtUtc,
            order.PaymentProofContentType));
    }
}
