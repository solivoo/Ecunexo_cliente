using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Business.Repairs.Excel;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Commands.ImportRepairBatch;

public sealed class ImportRepairBatchHandler : ICommandHandler<ImportRepairBatchCommand, ImportRepairBatchResponse>
{
    private readonly ICustomerRepository _customerRepository;
    private readonly ICustomerRepairRateCardRepository _rateCardRepository;
    private readonly IRepairBatchTemplateRepository _templateRepository;
    private readonly IRepairBatchRepository _batchRepository;
    private readonly IRepairEquipmentRepository _equipmentRepository;
    private readonly IRepairBatchExcelService _excelService;
    private readonly IUnitOfWork _unitOfWork;

    public ImportRepairBatchHandler(
        ICustomerRepository customerRepository,
        ICustomerRepairRateCardRepository rateCardRepository,
        IRepairBatchTemplateRepository templateRepository,
        IRepairBatchRepository batchRepository,
        IRepairEquipmentRepository equipmentRepository,
        IRepairBatchExcelService excelService,
        IUnitOfWork unitOfWork)
    {
        _customerRepository = customerRepository;
        _rateCardRepository = rateCardRepository;
        _templateRepository = templateRepository;
        _batchRepository = batchRepository;
        _equipmentRepository = equipmentRepository;
        _excelService = excelService;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ImportRepairBatchResponse>> Handle(ImportRepairBatchCommand command, CancellationToken ct)
    {
        var customer = await _customerRepository.GetByIdAsync(command.TenantId, command.CustomerId, ct).ConfigureAwait(false);
        if (customer == null)
        {
            return Result.Failure<ImportRepairBatchResponse>(new Error("repairs.customer.not_found", "La empresa cliente especificada no existe.", ErrorType.NotFound));
        }

        var batchExists = await _batchRepository.ExistsByBatchNumberAsync(command.TenantId, command.BatchNumber, ct).ConfigureAwait(false);
        if (batchExists)
        {
            return Result.Failure<ImportRepairBatchResponse>(new Error("repairs.batch.duplicate_number", $"Ya existe un lote con el número '{command.BatchNumber}'.", ErrorType.Validation));
        }

        var rateCard = await _rateCardRepository
            .GetByCustomerAsync(command.TenantId, command.CustomerId, ct)
            .ConfigureAwait(false);

        var agreedRateN1 = command.AgreedRateN1 ?? rateCard?.RateN1;
        var agreedRateN2 = command.AgreedRateN2 ?? rateCard?.RateN2;
        var agreedRateN3 = command.AgreedRateN3 ?? rateCard?.RateN3;
        var contractReference = string.IsNullOrWhiteSpace(command.ContractReference)
            ? rateCard?.ContractReference
            : command.ContractReference;

        RepairBatchTemplate? template = null;
        if (command.TemplateId.HasValue)
        {
            template = await _templateRepository.GetByIdAsync(command.TenantId, command.TemplateId.Value, ct).ConfigureAwait(false);
        }

        template ??= await _templateRepository.GetDefaultOrActiveForCustomerAsync(command.TenantId, command.CustomerId, ct).ConfigureAwait(false);

        if (template == null)
        {
            // Fallback: crear plantilla en memoria con el esquema estándar de Whirlpool
            var defaultTemplateResult = RepairBatchTemplate.Create(
                Guid.NewGuid(),
                command.TenantId,
                "Plantilla Estándar Whirlpool",
                RepairTemplateSchemaDefaults.GetDefaultWhirlpoolSchemaJson(),
                command.CustomerId);

            template = defaultTemplateResult.Value!;
        }

        var parseResult = _excelService.ParseBatchWorkbook(command.ExcelStream, template);
        if (!parseResult.IsSuccess)
        {
            var firstErrors = string.Join("; ", parseResult.Errors.Take(5));
            return Result.Failure<ImportRepairBatchResponse>(new Error("repairs.import.validation_failed", $"Errores en el archivo Excel: {firstErrors}", ErrorType.Validation));
        }

        var batchId = Guid.NewGuid();
        var batchResult = RepairBatch.Create(
            batchId,
            command.TenantId,
            command.CustomerId,
            command.BatchNumber,
            command.TemplateId,
            agreedRateN1,
            agreedRateN2,
            agreedRateN3,
            contractReference,
            command.ExpectedCompletionAt,
            DateTimeOffset.UtcNow);

        if (batchResult.IsFailure)
        {
            return Result.Failure<ImportRepairBatchResponse>(batchResult.Error!);
        }

        var batch = batchResult.Value!;
        var equipments = new List<RepairEquipment>();
        var n1 = 0;
        var n2 = 0;
        var n3 = 0;

        foreach (var item in parseResult.Items)
        {
            if (command.ExcludedRowNumbers != null && command.ExcludedRowNumbers.Contains(item.RowNumber))
            {
                continue;
            }

            if (command.ExcludedSerialNumbers != null && command.ExcludedSerialNumbers.Contains(item.SerialNumber, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            var eqResult = RepairEquipment.Create(
                Guid.NewGuid(),
                command.TenantId,
                batchId,
                item.SerialNumber,
                item.Model,
                item.Brand,
                item.DamageLevel,
                item.ProductLine,
                item.CustomAttributesJson);

            if (eqResult.IsFailure)
            {
                return Result.Failure<ImportRepairBatchResponse>(eqResult.Error!);
            }

            equipments.Add(eqResult.Value!);

            switch (item.DamageLevel)
            {
                case DamageLevel.Level1: n1++; break;
                case DamageLevel.Level2: n2++; break;
                case DamageLevel.Level3: n3++; break;
            }
        }

        if (equipments.Count == 0)
        {
            return Result.Failure<ImportRepairBatchResponse>(
                new Error("repairs.import.no_equipments_selected", "Debes seleccionar al menos un equipo para importar el lote.", ErrorType.Validation));
        }

        batch.RecalculateCounters(
            total: equipments.Count,
            received: equipments.Count,
            inRepair: 0,
            ready: 0,
            dispatched: 0);

        await _batchRepository.AddAsync(batch, ct).ConfigureAwait(false);
        await _equipmentRepository.AddRangeAsync(equipments, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new ImportRepairBatchResponse(
            BatchId: batch.Id,
            BatchNumber: batch.BatchNumber,
            TotalImported: equipments.Count,
            Level1Count: n1,
            Level2Count: n2,
            Level3Count: n3,
            Warnings: parseResult.Warnings);
    }
}
