using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.UploadStorefrontPaymentProof;

/// <summary>Subida pública del comprobante de pago de un pedido de la tienda.</summary>
public sealed record UploadStorefrontPaymentProofCommand(
    Guid TenantId,
    Guid OrderId,
    string? Token,
    string FileName,
    string? ContentType,
    long Length,
    Stream Content) : ICommand<StorefrontPaymentProofUploadedDto>;
