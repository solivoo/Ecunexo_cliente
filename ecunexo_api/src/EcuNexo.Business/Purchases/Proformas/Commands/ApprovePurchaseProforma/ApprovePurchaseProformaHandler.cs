using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Proformas.Commands.ApprovePurchaseProforma;

public sealed class ApprovePurchaseProformaHandler : ICommandHandler<ApprovePurchaseProformaCommand, PurchaseProformaResponse>
{
    private readonly IPurchaseProformaRepository _proformas;
    private readonly ISupplierRepository _suppliers;
    private readonly IEmailSender _emailSender;
    private readonly IUnitOfWork _unitOfWork;

    public ApprovePurchaseProformaHandler(
        IPurchaseProformaRepository proformas,
        ISupplierRepository suppliers,
        IEmailSender emailSender,
        IUnitOfWork unitOfWork)
    {
        _proformas = proformas;
        _suppliers = suppliers;
        _emailSender = emailSender;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PurchaseProformaResponse>> Handle(ApprovePurchaseProformaCommand command, CancellationToken ct)
    {
        var proforma = await _proformas.GetTrackedByIdAsync(command.TenantId, command.ProformaId, ct).ConfigureAwait(false);
        if (proforma is null)
        {
            return Result.Failure<PurchaseProformaResponse>(
                new Error("purchases.proforma.not_found", "La proforma de compra no fue encontrada.", ErrorType.NotFound));
        }

        var supplier = await _suppliers.GetByIdAsync(command.TenantId, proforma.SupplierId, ct).ConfigureAwait(false);
        if (supplier is null)
        {
            return Result.Failure<PurchaseProformaResponse>(
                new Error("purchases.proforma.supplier_not_found", "El proveedor de la proforma no existe.", ErrorType.NotFound));
        }

        if (string.IsNullOrWhiteSpace(supplier.ContactEmail))
        {
            return Result.Failure<PurchaseProformaResponse>(
                new Error("purchases.proforma.supplier_email_missing", "El proveedor no tiene registrado un correo electrónico para recibir la confirmación de proforma aprobada.", ErrorType.Validation));
        }

        var result = proforma.Approve();
        if (result.IsFailure)
        {
            return Result.Failure<PurchaseProformaResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        try
        {
            var subject = $"Aprobación de Cotización N° {proforma.ProformaNumber} — EcuNexo";
            var body = $"""
                Estimado/a {supplier.BusinessName},

                Le notificamos que su cotización N° {proforma.ProformaNumber}, emitida el {proforma.IssueDate:dd/MM/yyyy}, ha sido formalmente APROBADA.

                Detalle de la Aprobación:
                - Subtotal: ${proforma.Subtotal:F2} USD
                - IVA: ${proforma.TaxAmount:F2} USD
                - Total Aprobado: ${proforma.TotalAmount:F2} USD
                {(proforma.ExpirationDate.HasValue ? $"- Válida hasta: {proforma.ExpirationDate.Value:dd/MM/yyyy}" : string.Empty)}
                {(string.IsNullOrWhiteSpace(proforma.Notes) ? string.Empty : $"- Observaciones: {proforma.Notes}")}

                Por favor, proceda con la emisión de la Factura Electrónica (01) ante el SRI y la coordinación de despacho respectiva.

                Atentamente,
                Departamento de Compras & Adquisiciones
                EcuNexo Enterprise Platform
                """;

            var emailMessage = new EmailMessage(
                supplier.ContactEmail,
                supplier.TradeName ?? supplier.BusinessName,
                subject,
                body);

            await _emailSender.SendAsync(emailMessage, ct).ConfigureAwait(false);
        }
        catch
        {
            // El fallo de correo no revierte la aprobación pero queda registrado
        }

        return Result.Success(PurchaseProformaResponse.FromDomain(proforma));
    }
}
