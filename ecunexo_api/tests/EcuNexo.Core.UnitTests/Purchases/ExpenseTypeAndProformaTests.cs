using EcuNexo.Core.Purchases;

namespace EcuNexo.Core.UnitTests.Purchases;

public sealed class ExpenseTypeAndProformaTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact(DisplayName = "ExpenseType.Create con campos válidos es exitoso")]
    public void ExpenseType_Create_Valid_Succeeds()
    {
        var result = ExpenseType.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            code: "GASTO_MERCADERIA",
            name: "Mercadería para reventa",
            sriSustentoCode: "01",
            affectsInventory: true,
            isSystem: true,
            suggestedRetentionCode: "312",
            description: "Adquisición de inventario físico para comercio");

        result.IsSuccess.Should().BeTrue();
        var expense = result.Value!;
        expense.Code.Should().Be("GASTO_MERCADERIA");
        expense.SriSustentoCode.Should().Be("01");
        expense.AffectsInventory.Should().BeTrue();
        expense.IsSystem.Should().BeTrue();
        expense.SuggestedRetentionCode.Should().Be("312");
    }

    [Fact(DisplayName = "ExpenseType.Deactivate en tipo de sistema falla")]
    public void ExpenseType_Deactivate_SystemType_Fails()
    {
        var expense = ExpenseType.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            code: "GASTO_BASE",
            name: "Gasto Base",
            isSystem: true).Value!;

        var result = expense.Deactivate();

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("expense_type.system.nodeactivate");
    }

    [Fact(DisplayName = "PurchaseProforma calcula subtotales, IVA y total correctamente")]
    public void PurchaseProforma_AddItems_CalculatesTotalsCorrectly()
    {
        var proforma = PurchaseProforma.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: Guid.NewGuid(),
            proformaNumber: "PROF-2026-001",
            issueDate: DateOnly.FromDateTime(DateTime.UtcNow)).Value!;

        // Ítem 1: 10 unidades a $10.00 con 15% IVA = $100 subtotal, $15 IVA
        var item1 = proforma.AddItem(
            id: Guid.NewGuid(),
            description: "Cajas de embalaje corrugado",
            quantity: 10,
            unitPrice: 10.00m,
            taxRate: 15.00m);

        // Ítem 2: 5 unidades a $20.00 con 0% IVA = $100 subtotal, $0 IVA
        var item2 = proforma.AddItem(
            id: Guid.NewGuid(),
            description: "Servicio exento",
            quantity: 5,
            unitPrice: 20.00m,
            taxRate: 0.00m);

        item1.IsSuccess.Should().BeTrue();
        item2.IsSuccess.Should().BeTrue();

        proforma.Items.Should().HaveCount(2);
        proforma.Subtotal.Should().Be(200.00m);
        proforma.TaxAmount.Should().Be(15.00m);
        proforma.TotalAmount.Should().Be(215.00m);
    }

    [Fact(DisplayName = "PurchaseProforma.Approve cambia estado a Approved y bloquea nuevas líneas")]
    public void PurchaseProforma_Approve_TransitionsStateAndLocksEdits()
    {
        var proforma = PurchaseProforma.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: Guid.NewGuid(),
            proformaNumber: "PROF-002",
            issueDate: DateOnly.FromDateTime(DateTime.UtcNow)).Value!;

        proforma.AddItem(Guid.NewGuid(), "Mouse Inalámbrico", 2, 15m, 15m);

        var approveResult = proforma.Approve();
        approveResult.IsSuccess.Should().BeTrue();
        proforma.Status.Should().Be(PurchaseProformaStatus.Approved);

        // Intentar agregar ítem después de aprobada debe fallar
        var addAfterApprove = proforma.AddItem(Guid.NewGuid(), "Teclado", 1, 30m);
        addAfterApprove.IsFailure.Should().BeTrue();
        addAfterApprove.Error!.Code.Should().Be("proforma.status.readonly");
    }

    [Fact(DisplayName = "PurchaseProforma.MarkConvertedToPurchase asigna purchaseId")]
    public void PurchaseProforma_MarkConvertedToPurchase_Succeeds()
    {
        var proforma = PurchaseProforma.Create(
            id: Guid.NewGuid(),
            tenantId: TenantId,
            supplierId: Guid.NewGuid(),
            proformaNumber: "PROF-003",
            issueDate: DateOnly.FromDateTime(DateTime.UtcNow)).Value!;

        proforma.AddItem(Guid.NewGuid(), "Repuesto N1", 1, 50m);
        proforma.Approve();

        var purchaseId = Guid.NewGuid();
        var convertResult = proforma.MarkConvertedToPurchase(purchaseId);

        convertResult.IsSuccess.Should().BeTrue();
        proforma.Status.Should().Be(PurchaseProformaStatus.ConvertedToPurchase);
        proforma.ConvertedPurchaseId.Should().Be(purchaseId);
    }
}
