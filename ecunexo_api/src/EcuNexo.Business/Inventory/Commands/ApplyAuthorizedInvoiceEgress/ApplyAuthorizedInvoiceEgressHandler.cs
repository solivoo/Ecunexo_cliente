using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Inventory.Commands.ApplyAuthorizedInvoiceEgress;

public sealed class ApplyAuthorizedInvoiceEgressHandler
    : ICommandHandler<ApplyAuthorizedInvoiceEgressCommand, ApplyAuthorizedInvoiceEgressResponse>
{
    private readonly IValidator<ApplyAuthorizedInvoiceEgressCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IInvoiceStockEgressRepository _egresses;
    private readonly DefaultWarehouseProvisioner _warehouseProvisioner;
    private readonly IWarehouseRepository _warehouses;
    private readonly ICatalogItemRepository _items;
    private readonly IInventoryDocumentRepository _documents;
    private readonly InventoryDocumentApprovalService _approval;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public ApplyAuthorizedInvoiceEgressHandler(
        IValidator<ApplyAuthorizedInvoiceEgressCommand> validator,
        ITenantRepository tenants,
        IInvoiceStockEgressRepository egresses,
        DefaultWarehouseProvisioner warehouseProvisioner,
        IWarehouseRepository warehouses,
        ICatalogItemRepository items,
        IInventoryDocumentRepository documents,
        InventoryDocumentApprovalService approval,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _tenants = tenants;
        _egresses = egresses;
        _warehouseProvisioner = warehouseProvisioner;
        _warehouses = warehouses;
        _items = items;
        _documents = documents;
        _approval = approval;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ApplyAuthorizedInvoiceEgressResponse>> Handle(
        ApplyAuthorizedInvoiceEgressCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<ApplyAuthorizedInvoiceEgressResponse>(
                new Error("inventory.billing_egress.validation", message, ErrorType.Validation));
        }

        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<ApplyAuthorizedInvoiceEgressResponse>(
                new Error("tenancy.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        // Sin módulo inventory: no error — la factura puede ser solo servicios.
        if (!tenant.HasModuleWithMinTier(TenantModuleCodes.Inventory))
        {
            return Result.Success(
                new ApplyAuthorizedInvoiceEgressResponse(
                    command.BillingInvoiceId,
                    null,
                    Skipped: true,
                    AlreadyApplied: false,
                    "Tenant sin módulo inventory; egreso omitido."));
        }

        var existing = await _egresses
            .GetByBillingInvoiceAsync(command.TenantId, command.BillingInvoiceId, ct)
            .ConfigureAwait(false);
        if (existing is not null)
        {
            return Result.Success(
                new ApplyAuthorizedInvoiceEgressResponse(
                    command.BillingInvoiceId,
                    existing.InventoryDocumentId,
                    Skipped: false,
                    AlreadyApplied: true,
                    "Egreso ya aplicado (idempotente)."));
        }

        var physicalLines = command.Lines
            .Where(l => string.Equals(l.ItemKind, "physical", StringComparison.OrdinalIgnoreCase)
                        && l.CatalogItemId != Guid.Empty
                        && l.Quantity > 0)
            .GroupBy(l => l.CatalogItemId)
            .Select(g => (CatalogItemId: g.Key, Quantity: g.Sum(x => x.Quantity)))
            .ToList();

        if (physicalLines.Count == 0)
        {
            // Solo servicios o sin snapshot: registrar receipt vacío no; simplemente skip.
            return Result.Success(
                new ApplyAuthorizedInvoiceEgressResponse(
                    command.BillingInvoiceId,
                    null,
                    Skipped: true,
                    AlreadyApplied: false,
                    "Sin líneas físicas con catalogItemId; egreso omitido."));
        }

        await _warehouseProvisioner.EnsureAsync(command.TenantId, ct).ConfigureAwait(false);
        var main = await _warehouses.GetMainAsync(command.TenantId, ct).ConfigureAwait(false);
        if (main is null)
        {
            return Result.Failure<ApplyAuthorizedInvoiceEgressResponse>(
                new Error(
                    "warehousing.warehouse.main.required",
                    "Falta la bodega principal para el egreso automático.",
                    ErrorType.Conflict));
        }

        var itemIds = physicalLines.Select(l => l.CatalogItemId).ToList();
        var catalogItems = await _items.GetActiveByIdsAsync(command.TenantId, itemIds, ct).ConfigureAwait(false);
        if (catalogItems.Count != itemIds.Count)
        {
            return Result.Failure<ApplyAuthorizedInvoiceEgressResponse>(
                new Error("catalog.item.not_found", "Uno o más ítems de catálogo no existen.", ErrorType.NotFound));
        }

        foreach (var item in catalogItems)
        {
            var stockable = InventoryDocument.EnsureStockable(item);
            if (stockable.IsFailure)
            {
                return Result.Failure<ApplyAuthorizedInvoiceEgressResponse>(stockable.Error!);
            }
        }

        var lineInputs = physicalLines
            .Select(l => (_idGenerator.NewId(), l.CatalogItemId, l.Quantity))
            .ToList();
        var created = InventoryDocument.Create(
            _idGenerator.NewId(),
            command.TenantId,
            InventoryDocumentType.Issue,
            main.Id,
            notes: $"Egreso automático factura Billing {command.BillingInvoiceId:N}",
            lineInputs);
        if (created.IsFailure)
        {
            return Result.Failure<ApplyAuthorizedInvoiceEgressResponse>(created.Error!);
        }

        var document = created.Value!;
        await _documents.AddAsync(document, ct).ConfigureAwait(false);

        var posted = await _approval
            .ApproveAsync(document, main, catalogItems, ct)
            .ConfigureAwait(false);
        if (posted.IsFailure)
        {
            return Result.Failure<ApplyAuthorizedInvoiceEgressResponse>(posted.Error!);
        }

        var receipt = InvoiceStockEgress.Create(
            _idGenerator.NewId(),
            command.TenantId,
            command.BillingInvoiceId,
            document.Id);
        if (receipt.IsFailure)
        {
            return Result.Failure<ApplyAuthorizedInvoiceEgressResponse>(receipt.Error!);
        }

        await _egresses.AddAsync(receipt.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(
            new ApplyAuthorizedInvoiceEgressResponse(
                command.BillingInvoiceId,
                document.Id,
                Skipped: false,
                AlreadyApplied: false,
                "Egreso de inventario aplicado."));
    }
}
