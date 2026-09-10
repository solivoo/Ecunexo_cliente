using EcuNexo.Core.Repairs;

namespace EcuNexo.Core.UnitTests.Repairs;

public sealed class RepairEntitiesTests
{
    [Fact(DisplayName = "Customer.Create con datos válidos es exitoso")]
    public void Customer_Create_WithValidData_Succeeds()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        var result = Customer.Create(
            id,
            tenantId,
            "Whirlpool del Ecuador S.A.",
            "0992345671001",
            "garantias@whirlpool.com",
            "042999888",
            "Av. Juan Tanca Marengo Km 4.5",
            "Ing. Carlos Mendoza");

        result.IsSuccess.Should().BeTrue();
        var customer = result.Value!;
        customer.Id.Should().Be(id);
        customer.TenantId.Should().Be(tenantId);
        customer.Name.Should().Be("Whirlpool del Ecuador S.A.");
        customer.TaxId.Should().Be("0992345671001");
        customer.IsActive.Should().BeTrue();
    }

    [Fact(DisplayName = "Customer.Create sin nombre devuelve error de validación")]
    public void Customer_Create_WithoutName_Fails()
    {
        var result = Customer.Create(Guid.NewGuid(), Guid.NewGuid(), "   ");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("repairs.customer.name.empty");
    }

    [Fact(DisplayName = "RepairBatchTemplate.Create con JSON válido es exitoso")]
    public void RepairBatchTemplate_Create_WithValidSchema_Succeeds()
    {
        var schemaJson = "{\"columns\":[{\"key\":\"serial_number\",\"label\":\"Serie\",\"type\":\"string\"}]}";
        var result = RepairBatchTemplate.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Plantilla Whirlpool Lavadoras",
            schemaJson);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ColumnDefinitionsJson.Should().Be(schemaJson);
        result.Value!.IsActive.Should().BeTrue();
    }

    [Fact(DisplayName = "RepairBatchTemplate.Create con JSON inválido devuelve error")]
    public void RepairBatchTemplate_Create_WithInvalidJson_Fails()
    {
        var result = RepairBatchTemplate.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Plantilla rota",
            "{columns: [not a valid json}");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("repairs.template.json.invalid");
    }

    [Fact(DisplayName = "RepairBatch.Create inicializa contadores en 0 y estado Received")]
    public void RepairBatch_Create_WithValidData_Succeeds()
    {
        var batchId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var customerId = Guid.NewGuid();

        var result = RepairBatch.Create(
            batchId,
            tenantId,
            customerId,
            "LOT-2026-WPH-001",
            agreedRateN1: 25.00m,
            agreedRateN2: 50.00m,
            agreedRateN3: 100.00m);

        result.IsSuccess.Should().BeTrue();
        var batch = result.Value!;
        batch.BatchNumber.Should().Be("LOT-2026-WPH-001");
        batch.Status.Should().Be(RepairBatchStatus.Received);
        batch.TotalCount.Should().Be(0);
        batch.AgreedRateN1.Should().Be(25.00m);
    }

    [Fact(DisplayName = "RepairBatch.RecalculateCounters actualiza estado del lote correctamente")]
    public void RepairBatch_RecalculateCounters_UpdatesCountsAndStatus()
    {
        var batch = RepairBatch.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "LOT-001").Value!;

        // 1. En progreso cuando hay equipos en taller
        batch.RecalculateCounters(total: 50, received: 20, inRepair: 20, ready: 10, dispatched: 0);
        batch.Status.Should().Be(RepairBatchStatus.InProgress);

        // 2. Parcialmente despachado
        batch.RecalculateCounters(total: 50, received: 10, inRepair: 10, ready: 15, dispatched: 15);
        batch.Status.Should().Be(RepairBatchStatus.PartiallyDispatched);

        // 3. Completado cuando todos han sido despachados
        batch.RecalculateCounters(total: 50, received: 0, inRepair: 0, ready: 0, dispatched: 50);
        batch.Status.Should().Be(RepairBatchStatus.Completed);
    }

    [Fact(DisplayName = "RepairEquipment flujo de estados completo exitoso")]
    public void RepairEquipment_Workflow_FullSuccessPath()
    {
        var equipment = RepairEquipment.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "SN-WH-998877",
            "WWG16AK",
            "Whirlpool",
            DamageLevel.Level2,
            "Lavadora").Value!;

        equipment.Status.Should().Be(RepairEquipmentStatus.Received);

        // Iniciar Diagnóstico
        var techId = Guid.NewGuid();
        var diagResult = equipment.StartDiagnosis(techId, "Golpe en panel frontal");
        diagResult.IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.Diagnosing);
        equipment.AssignedTechnicianId.Should().Be(techId);

        // Iniciar Reparación
        var repResult = equipment.StartRepair("Desarmado de panel frontal y rectificación");
        repResult.IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.InRepair);

        // Enviar a Control de Calidad
        var qcSend = equipment.SendToQualityCheck("Trabajo finalizado, listo para prueba");
        qcSend.IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.QualityCheck);

        // Aprobar Control de Calidad
        var qcApprove = equipment.ApproveQualityCheck("Prueba de lavado OK, acabado estético 10/10");
        qcApprove.IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.ReadyToDispatch);
        equipment.PassedQualityCheck.Should().BeTrue();

        // Despachar
        var dispResult = equipment.MarkDispatched();
        dispResult.IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.Dispatched);

        // Facturar
        var invResult = equipment.MarkInvoiced(50.00m);
        invResult.IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.Invoiced);
        equipment.ServiceFeeApplied.Should().Be(50.00m);
    }

    [Fact(DisplayName = "RepairEquipment rechazo en control de calidad regresa a InRepair")]
    public void RepairEquipment_Workflow_RejectQualityCheck_ReturnsToInRepair()
    {
        var equipment = RepairEquipment.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "SN-001",
            "WWG16AK",
            "Whirlpool",
            DamageLevel.Level1).Value!;

        equipment.StartRepair().IsSuccess.Should().BeTrue();
        equipment.SendToQualityCheck().IsSuccess.Should().BeTrue();

        var rejectResult = equipment.RejectQualityCheck("Pintura con burbujas en esquina inferior");
        rejectResult.IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.InRepair);
        equipment.PassedQualityCheck.Should().BeFalse();
        equipment.QualityCheckNotes.Should().Be("Pintura con burbujas en esquina inferior");
    }

    [Fact(DisplayName = "RepairEquipment marcado como irreparable")]
    public void RepairEquipment_Workflow_MarkIrreparable_Succeeds()
    {
        var equipment = RepairEquipment.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "SN-002",
            "WWG16AK",
            "Whirlpool",
            DamageLevel.Level3).Value!;

        var result = equipment.MarkIrreparable("Tina partida y chasis descuadrado sin repuesto disponible");
        result.IsSuccess.Should().BeTrue();
        equipment.Status.Should().Be(RepairEquipmentStatus.Irreparable);
        equipment.DiagnosticNotes.Should().Contain("[IRREPARABLE]");
    }

    [Fact(DisplayName = "RepairDispatch creación, adición de ítems y confirmación genera hash QR")]
    public void RepairDispatch_Create_And_Confirm_Succeeds()
    {
        var dispatchId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var batchId = Guid.NewGuid();

        var dispatch = RepairDispatch.Create(
            dispatchId,
            tenantId,
            batchId,
            "DSP-2026-WPH-001").Value!;

        dispatch.Status.Should().Be(RepairDispatchStatus.Draft);
        dispatch.VerificationHash.Should().NotBeNullOrWhiteSpace();
        dispatch.VerificationHash.Length.Should().Be(32);

        // Agregar equipo
        var eqId = Guid.NewGuid();
        var item = RepairDispatchItem.Create(Guid.NewGuid(), dispatchId, eqId);
        dispatch.AddItem(item);
        dispatch.Items.Should().HaveCount(1);

        // Confirmar despacho
        var confirmResult = dispatch.Confirm(
            carrierName: "Transportes Ecuador Express",
            carrierDocument: "1718293847",
            carrierVehiclePlate: "ABC-1234");

        confirmResult.IsSuccess.Should().BeTrue();
        dispatch.Status.Should().Be(RepairDispatchStatus.Confirmed);
        dispatch.CarrierName.Should().Be("Transportes Ecuador Express");
        dispatch.CarrierVehiclePlate.Should().Be("ABC-1234");
        dispatch.DispatchedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "RepairDispatch confirmación sin ítems es rechazada")]
    public void RepairDispatch_Confirm_WithoutItems_Fails()
    {
        var dispatch = RepairDispatch.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "DSP-002").Value!;

        var result = dispatch.Confirm();
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("repairs.dispatch.items.empty");
    }
}
