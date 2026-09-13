using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;
using EcuNexo.Core.Purchases.Services;

namespace EcuNexo.Business.Purchases.Commands.ParseSriPurchaseXml;

public sealed record DetectedSupplierDto(
    Guid? ExistingSupplierId,
    string TaxId,
    string BusinessName,
    string? TradeName,
    string? Address,
    bool IsRegistered);

public sealed record ParsedLineWithMatchDto(
    string ItemCode,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal Subtotal,
    decimal TaxRate,
    decimal TaxAmount,
    decimal Total,
    Guid? MatchedCatalogItemId,
    string? MatchedCatalogItemName,
    bool CanAffectInventory);

public sealed record ParseSriPurchaseXmlResponse(
    DetectedSupplierDto Supplier,
    string InvoiceNumber,
    string AuthorizationNumber,
    DateOnly IssueDate,
    string DocumentType,
    decimal SubtotalZero,
    decimal SubtotalTaxed,
    decimal SubtotalNoSubject,
    decimal SubtotalExempt,
    decimal TaxRate,
    decimal TaxAmount,
    decimal TotalDiscount,
    decimal TotalAmount,
    string? PaymentMethodCode,
    int CreditDays,
    IReadOnlyList<ParsedLineWithMatchDto> Lines,
    string RawXml,
    SriValidationReport? ValidationReport = null,
    bool IsAlreadyRegistered = false,
    Guid? ExistingPurchaseId = null,
    string? ExistingPurchaseInvoiceNumber = null);

public sealed record ParseSriPurchaseXmlCommand(
    Guid TenantId,
    string XmlContent) : ICommand<ParseSriPurchaseXmlResponse>;

public sealed class ParseSriPurchaseXmlHandler : ICommandHandler<ParseSriPurchaseXmlCommand, ParseSriPurchaseXmlResponse>
{
    private readonly ISupplierRepository _suppliers;
    private readonly ICatalogItemRepository _catalogItems;
    private readonly IPurchaseRepository _purchases;

    public ParseSriPurchaseXmlHandler(
        ISupplierRepository suppliers,
        ICatalogItemRepository catalogItems,
        IPurchaseRepository purchases)
    {
        _suppliers = suppliers;
        _catalogItems = catalogItems;
        _purchases = purchases;
    }

    public async Task<Result<ParseSriPurchaseXmlResponse>> Handle(
        ParseSriPurchaseXmlCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty)
        {
            return Result.Failure<ParseSriPurchaseXmlResponse>(
                new Error("purchases.parse_xml.tenant_empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        var parseResult = SriPurchaseXmlParser.Parse(command.XmlContent);
        if (parseResult.IsFailure)
        {
            return Result.Failure<ParseSriPurchaseXmlResponse>(parseResult.Error!);
        }

        var parsed = parseResult.Value!;

        // 1. Detectar si el proveedor ya existe en el directorio del tenant
        var existingSupplier = await _suppliers.GetByTaxIdAsync(command.TenantId, parsed.SupplierTaxId, ct).ConfigureAwait(false);

        var detectedSupplier = new DetectedSupplierDto(
            ExistingSupplierId: existingSupplier?.Id,
            TaxId: parsed.SupplierTaxId,
            BusinessName: existingSupplier?.BusinessName ?? parsed.SupplierBusinessName,
            TradeName: existingSupplier?.TradeName ?? parsed.SupplierTradeName,
            Address: existingSupplier?.Address ?? parsed.SupplierAddress,
            IsRegistered: existingSupplier is not null
        );

        // 2. Detectar si el comprobante ya está registrado previamente en el sistema (por clave de autorización o proveedor + número)
        Purchase? existingByAuth = null;
        if (!string.IsNullOrWhiteSpace(parsed.AuthorizationNumber))
        {
            existingByAuth = await _purchases.GetByAuthorizationNumberAsync(command.TenantId, parsed.AuthorizationNumber.Trim(), ct).ConfigureAwait(false);
        }

        var existsByNumber = existingSupplier is not null && await _purchases.ExistsByInvoiceNumberAsync(
            command.TenantId, existingSupplier.Id, parsed.InvoiceNumber, null, ct).ConfigureAwait(false);

        bool isAlreadyRegistered = existingByAuth is not null || existsByNumber;
        Guid? existingPurchaseId = existingByAuth?.Id;
        string? existingInvoiceNumber = existingByAuth?.InvoiceNumber ?? (existsByNumber ? parsed.InvoiceNumber : null);

        var report = parsed.ValidationReport;
        if (isAlreadyRegistered && report is not null)
        {
            var alerts = new List<SriValidationAlert>(report.Alerts)
            {
                new(
                    Code: "DUPLICATE_PURCHASE_REGISTERED",
                    Title: "Comprobante Ya Registrado en Sistema",
                    Message: $"Esta factura ({parsed.InvoiceNumber}) ya se encuentra registrada en el sistema EcuNexo.",
                    Severity: "danger",
                    Recommendation: "No vuelva a importar esta factura para evitar duplicar existencias o registros tributarios."
                )
            };
            report = report with
            {
                OverallStatus = "danger",
                Alerts = alerts.AsReadOnly()
            };
        }

        // 2. Correlacionar ítems de la factura con el catálogo de productos del tenant por SKU / Código
        var skus = parsed.Lines
            .Where(l => !string.IsNullOrWhiteSpace(l.ItemCode))
            .Select(l => l.ItemCode.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var matchedItems = new Dictionary<string, (Guid Id, string Name)>(StringComparer.OrdinalIgnoreCase);
        if (skus.Count > 0)
        {
            var catalogItems = await _catalogItems.ListActiveByTenantAsync(command.TenantId, null, null, ct).ConfigureAwait(false) ?? [];
            foreach (var ci in catalogItems)
            {
                if (ci is not null && !string.IsNullOrWhiteSpace(ci.Sku) && skus.Contains(ci.Sku, StringComparer.OrdinalIgnoreCase))
                {
                    matchedItems[ci.Sku] = (ci.Id, ci.Name);
                }
            }
        }

        var linesWithMatch = new List<ParsedLineWithMatchDto>(parsed.Lines.Count);
        foreach (var line in parsed.Lines)
        {
            Guid? matchedId = null;
            string? matchedName = null;

            if (!string.IsNullOrWhiteSpace(line.ItemCode) && matchedItems.TryGetValue(line.ItemCode, out var match))
            {
                matchedId = match.Id;
                matchedName = match.Name;
            }

            linesWithMatch.Add(new ParsedLineWithMatchDto(
                ItemCode: line.ItemCode,
                Description: line.Description,
                Quantity: line.Quantity,
                UnitPrice: line.UnitPrice,
                Discount: line.Discount,
                Subtotal: line.Subtotal,
                TaxRate: line.TaxRate,
                TaxAmount: line.TaxAmount,
                Total: line.Total,
                MatchedCatalogItemId: matchedId,
                MatchedCatalogItemName: matchedName,
                CanAffectInventory: matchedId.HasValue
            ));
        }

        var response = new ParseSriPurchaseXmlResponse(
            Supplier: detectedSupplier,
            InvoiceNumber: parsed.InvoiceNumber,
            AuthorizationNumber: parsed.AuthorizationNumber,
            IssueDate: parsed.IssueDate,
            DocumentType: parsed.DocumentType,
            SubtotalZero: parsed.SubtotalZero,
            SubtotalTaxed: parsed.SubtotalTaxed,
            SubtotalNoSubject: parsed.SubtotalNoSubject,
            SubtotalExempt: parsed.SubtotalExempt,
            TaxRate: parsed.TaxRate,
            TaxAmount: parsed.TaxAmount,
            TotalDiscount: parsed.TotalDiscount,
            TotalAmount: parsed.TotalAmount,
            PaymentMethodCode: parsed.PaymentMethodCode,
            CreditDays: parsed.CreditDays,
            Lines: linesWithMatch.AsReadOnly(),
            RawXml: parsed.RawXml,
            ValidationReport: report,
            IsAlreadyRegistered: isAlreadyRegistered,
            ExistingPurchaseId: existingPurchaseId,
            ExistingPurchaseInvoiceNumber: existingInvoiceNumber
        );

        return Result.Success(response);
    }
}
