using ClosedXML.Excel;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Commands.CreateRepairDispatch;
using EcuNexo.Business.Repairs.Commands.ImportRepairBatch;
using EcuNexo.Business.Repairs.Commands.UpdateEquipmentStatus;
using EcuNexo.Business.Repairs.Excel;
using EcuNexo.Business.Repairs.Queries.VerifyDispatchPublic;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Repairs;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Repairs;

public sealed class RepairHandlersTests
{
    private readonly ICustomerRepository _customerRepo = Substitute.For<ICustomerRepository>();
    private readonly IRepairBatchTemplateRepository _templateRepo = Substitute.For<IRepairBatchTemplateRepository>();
    private readonly IRepairBatchRepository _batchRepo = Substitute.For<IRepairBatchRepository>();
    private readonly IRepairEquipmentRepository _equipmentRepo = Substitute.For<IRepairEquipmentRepository>();
    private readonly IRepairDispatchRepository _dispatchRepo = Substitute.For<IRepairDispatchRepository>();
    private readonly IRepairBatchExcelService _excelService = new RepairBatchExcelService();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact(DisplayName = "ImportRepairBatchHandler importa exitosamente lote y equipos desde Excel")]
    public async Task ImportRepairBatchHandler_WithValidExcel_Succeeds()
    {
        var tenantId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var customer = Customer.Create(customerId, tenantId, "Whirlpool del Ecuador S.A.").Value!;

        _customerRepo.GetByIdAsync(tenantId, customerId, Arg.Any<CancellationToken>())
            .Returns(customer);

        _batchRepo.ExistsByBatchNumberAsync(tenantId, "LOT-WPH-001", Arg.Any<CancellationToken>())
            .Returns(false);

        // Crear stream Excel simulado
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Equipos");
        ws.Cell(1, 1).Value = "Número de Serie";
        ws.Cell(1, 2).Value = "Modelo";
        ws.Cell(1, 3).Value = "Marca";
        ws.Cell(1, 4).Value = "Línea de Producto";
        ws.Cell(1, 5).Value = "Nivel de Golpe";
        ws.Cell(1, 6).Value = "Pallet";

        ws.Cell(2, 1).Value = "SN-TEST-01";
        ws.Cell(2, 2).Value = "WWG16AK";
        ws.Cell(2, 3).Value = "Whirlpool";
        ws.Cell(2, 4).Value = "Lavadora";
        ws.Cell(2, 5).Value = "Nivel 1 (Leve)";
        ws.Cell(2, 6).Value = "PLT-1";

        ws.Cell(3, 1).Value = "SN-TEST-02";
        ws.Cell(3, 2).Value = "WWG16AK";
        ws.Cell(3, 3).Value = "Whirlpool";
        ws.Cell(3, 4).Value = "Lavadora";
        ws.Cell(3, 5).Value = "Nivel 2 (Medio)";
        ws.Cell(3, 6).Value = "PLT-1";

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Position = 0;

        var handler = new ImportRepairBatchHandler(
            _customerRepo,
            _templateRepo,
            _batchRepo,
            _equipmentRepo,
            _excelService,
            _unitOfWork);

        var command = new ImportRepairBatchCommand(
            TenantId: tenantId,
            CustomerId: customerId,
            BatchNumber: "LOT-WPH-001",
            TemplateId: null,
            AgreedRateN1: 30m,
            AgreedRateN2: 60m,
            AgreedRateN3: 120m,
            ContractReference: "CTR-2026",
            ExpectedCompletionAt: null,
            ExcelStream: ms);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalImported.Should().Be(2);
        result.Value!.Level1Count.Should().Be(1);
        result.Value!.Level2Count.Should().Be(1);

        await _batchRepo.Received(1).AddAsync(Arg.Any<RepairBatch>(), Arg.Any<CancellationToken>());
        await _equipmentRepo.Received(1).AddRangeAsync(Arg.Is<IEnumerable<RepairEquipment>>(e => e.Count() == 2), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "UpdateEquipmentStatusHandler avanza estado y recalcula lote")]
    public async Task UpdateEquipmentStatusHandler_AdvancesStatus_AndRecalculatesBatch()
    {
        var tenantId = Guid.NewGuid();
        var batchId = Guid.NewGuid();
        var eqId = Guid.NewGuid();
        var techId = Guid.NewGuid();

        var equipment = RepairEquipment.Create(
            eqId,
            tenantId,
            batchId,
            "SN-001",
            "WWG16AK",
            "Whirlpool",
            DamageLevel.Level1).Value!;

        var batch = RepairBatch.Create(batchId, tenantId, Guid.NewGuid(), "LOT-01").Value!;

        _equipmentRepo.GetTrackedAsync(tenantId, eqId, Arg.Any<CancellationToken>())
            .Returns(equipment);

        _batchRepo.GetTrackedWithEquipmentsAsync(tenantId, batchId, Arg.Any<CancellationToken>())
            .Returns(batch);

        var handler = new UpdateEquipmentStatusHandler(_equipmentRepo, _batchRepo, _unitOfWork);

        var command = new UpdateEquipmentStatusCommand(
            TenantId: tenantId,
            EquipmentId: eqId,
            TargetStatus: RepairEquipmentStatus.Diagnosing,
            TechnicianId: techId,
            Notes: "Iniciando diagnóstico en banco de pruebas");

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.NewStatus.Should().Be(RepairEquipmentStatus.Diagnosing);
        equipment.Status.Should().Be(RepairEquipmentStatus.Diagnosing);
        equipment.AssignedTechnicianId.Should().Be(techId);

        await _equipmentRepo.Received(1).AddEventAsync(Arg.Any<RepairEquipmentEvent>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateRepairDispatchHandler despacha equipos listos y genera hash QR")]
    public async Task CreateRepairDispatchHandler_DispatchesReadyEquipments()
    {
        var tenantId = Guid.NewGuid();
        var batchId = Guid.NewGuid();
        var eqId = Guid.NewGuid();

        var equipment = RepairEquipment.Create(
            eqId,
            tenantId,
            batchId,
            "SN-READY-01",
            "WWG16AK",
            "Whirlpool",
            DamageLevel.Level1).Value!;

        equipment.StartRepair().IsSuccess.Should().BeTrue();
        equipment.SendToQualityCheck().IsSuccess.Should().BeTrue();
        equipment.ApproveQualityCheck().IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.ReadyToDispatch);

        var batch = RepairBatch.Create(batchId, tenantId, Guid.NewGuid(), "LOT-01").Value!;
        // Asociar equipo al lote mediante reflection / interna para prueba
        var equipmentsField = typeof(RepairBatch).GetField("_equipments", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        var list = (List<RepairEquipment>)equipmentsField!.GetValue(batch)!;
        list.Add(equipment);

        _batchRepo.GetTrackedWithEquipmentsAsync(tenantId, batchId, Arg.Any<CancellationToken>())
            .Returns(batch);

        var handler = new CreateRepairDispatchHandler(_batchRepo, _dispatchRepo, _equipmentRepo, _unitOfWork);

        var command = new CreateRepairDispatchCommand(
            TenantId: tenantId,
            BatchId: batchId,
            DispatchNumber: "DSP-2026-001",
            EquipmentIds: [eqId],
            CarrierName: "Servientrega",
            CarrierVehiclePlate: "ABC-123");

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.DispatchNumber.Should().Be("DSP-2026-001");
        result.Value!.DispatchedCount.Should().Be(1);
        result.Value!.VerificationHash.Should().NotBeNullOrWhiteSpace();
        equipment.Status.Should().Be(RepairEquipmentStatus.Dispatched);

        await _dispatchRepo.Received(1).AddAsync(Arg.Any<RepairDispatch>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "VerifyDispatchPublicHandler devuelve información para escaneo QR anónimo")]
    public async Task VerifyDispatchPublicHandler_ReturnsPublicInfo()
    {
        var dispatch = RepairDispatch.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "DSP-PUBLIC-01",
            carrierName: "Transportes Whirlpool").Value!;

        _dispatchRepo.GetByVerificationHashAsync(dispatch.VerificationHash, Arg.Any<CancellationToken>())
            .Returns(dispatch);

        var handler = new VerifyDispatchPublicHandler(_dispatchRepo);
        var result = await handler.Handle(new VerifyDispatchPublicQuery(dispatch.VerificationHash), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.DispatchNumber.Should().Be("DSP-PUBLIC-01");
        result.Value!.CarrierName.Should().Be("Transportes Whirlpool");
    }
}
