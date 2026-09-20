using System.Text.Json;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.UnitTests.Support;

namespace EcuNexo.Core.UnitTests.Catalog;

/// <summary>
/// Prioridad 1 — Catálogo es la base: sin ítem físico/válido no hay stock ni factura limpia.
/// </summary>
public sealed class CatalogItemTests
{
    [Fact(DisplayName = "Ítem físico sin SKU se rechaza (ADR-010: 1 físico = 1 SKU)")]
    public void Create_PhysicalWithoutSku_ReturnsValidationError()
    {
        // Preparar / Actuar
        var result = CatalogItem.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Producto sin código",
            description: null,
            sku: null,
            basePrice: 10m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.sku.required");
    }

    [Fact(DisplayName = "Ítem de servicio puede crearse sin SKU (plan services-starter)")]
    public void Create_ServiceWithoutSku_Succeeds()
    {
        // Preparar / Actuar
        var item = CatalogTestFactory.Service();

        // Verificar
        item.Kind.Should().Be(CatalogItemKind.Service);
        item.Sku.Should().BeNull();
    }

    [Fact(DisplayName = "Ítem físico con SKU válido queda activo")]
    public void Create_PhysicalWithSku_Succeeds()
    {
        // Preparar / Actuar
        var item = CatalogTestFactory.Physical(sku: "SKU-001");

        // Verificar
        item.Kind.Should().Be(CatalogItemKind.Physical);
        item.Sku.Should().Be("SKU-001");
        item.Status.Should().Be(CatalogItemStatus.Active);
    }

    [Fact(DisplayName = "Servicio puede pasar a físico si se informa SKU")]
    public void ChangeKind_ServiceToPhysicalWithSku_Succeeds()
    {
        var item = CatalogTestFactory.Service(name: "Mouse");

        var result = item.ChangeKind(CatalogItemKind.Physical, "MOU01", updatedBy: null);

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        item.Kind.Should().Be(CatalogItemKind.Physical);
        item.Sku.Should().Be("MOU01");
    }

    [Fact(DisplayName = "Servicio a físico sin SKU se rechaza")]
    public void ChangeKind_ServiceToPhysicalWithoutSku_ReturnsValidationError()
    {
        var item = CatalogTestFactory.Service();

        var result = item.ChangeKind(CatalogItemKind.Physical, sku: null, updatedBy: null);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.sku.required");
        item.Kind.Should().Be(CatalogItemKind.Service);
    }

    [Fact(DisplayName = "Físico puede pasar a servicio")]
    public void ChangeKind_PhysicalToService_Succeeds()
    {
        var item = CatalogTestFactory.Physical();

        var result = item.ChangeKind(CatalogItemKind.Service, sku: null, updatedBy: null);

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        item.Kind.Should().Be(CatalogItemKind.Service);
        item.Sku.Should().BeNull();
    }

    [Fact(DisplayName = "NormalizeSchema rechaza claves duplicadas")]
    public void NormalizeSchema_DuplicateKeys_ReturnsValidationError()
    {
        var json = """[{"key":"color","label":"Color"},{"key":"color","label":"Color 2"}]""";
        var result = CatalogAttributeSchema.NormalizeSchema(json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.schema.duplicate_key");
    }

    [Fact(DisplayName = "NormalizeSchema rechaza etiquetas duplicadas")]
    public void NormalizeSchema_DuplicateLabels_ReturnsValidationError()
    {
        var json = """[{"key":"capacidad_1","label":"Capacidad"},{"key":"capacidad_2","label":"Capacidad"}]""";
        var result = CatalogAttributeSchema.NormalizeSchema(json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.schema.duplicate_label");
    }

    [Fact(DisplayName = "NormalizeSchema rechaza campos que coinciden con campos nativos del ítem")]
    public void NormalizeSchema_ReservedKeyOrLabel_ReturnsValidationError()
    {
        var json = """[{"key":"nombre","label":"Nombre"}]""";
        var result = CatalogAttributeSchema.NormalizeSchema(json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.schema.reserved_key");
    }

    [Fact(DisplayName = "Reasigna variante a otro producto matriz y registra historial de auditoría")]
    public void ReassignParent_ValidTarget_UpdatesParentAndRecordsAudit()
    {
        var tenantId = Guid.CreateVersion7();
        var parentA = CatalogTestFactory.MatrixParent(tenantId: tenantId, name: "Matriz A", sku: "MAT-A");
        var parentB = CatalogTestFactory.MatrixParent(tenantId: tenantId, name: "Matriz B", sku: "MAT-B");
        var variant = CatalogTestFactory.VariantChild(parentA, sku: "VAR-001");
        var userId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;

        var result = variant.ReassignParent(parentB, "Movido por corrección de catálogo", parentA, userId, now);

        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        variant.ParentId.Should().Be(parentB.Id);

        using var doc = JsonDocument.Parse(variant.CustomAttributesJson);
        doc.RootElement.TryGetProperty("parent_reassignment_history", out var historyEl).Should().BeTrue();
        historyEl.GetArrayLength().Should().Be(1);

        var entry = historyEl[0];
        entry.GetProperty("reason").GetString().Should().Be("Movido por corrección de catálogo");
        entry.GetProperty("previous_parent_id").GetString().Should().Be(parentA.Id.ToString());
        entry.GetProperty("previous_parent_sku").GetString().Should().Be("MAT-A");
        entry.GetProperty("previous_parent_name").GetString().Should().Be("Matriz A");
        entry.GetProperty("target_parent_id").GetString().Should().Be(parentB.Id.ToString());
        entry.GetProperty("target_parent_sku").GetString().Should().Be("MAT-B");
        entry.GetProperty("target_parent_name").GetString().Should().Be("Matriz B");
        entry.GetProperty("moved_by").GetString().Should().Be(userId.ToString());
    }

    [Fact(DisplayName = "Reasigna variante a standalone desenlazando matriz padre y acumulando auditoría")]
    public void ReassignParent_ToStandalone_UnlinksParentAndAppendsAudit()
    {
        var tenantId = Guid.CreateVersion7();
        var parentA = CatalogTestFactory.MatrixParent(tenantId: tenantId, name: "Matriz A", sku: "MAT-A");
        var parentB = CatalogTestFactory.MatrixParent(tenantId: tenantId, name: "Matriz B", sku: "MAT-B");
        var variant = CatalogTestFactory.VariantChild(parentA, sku: "VAR-002");
        var userId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;

        variant.ReassignParent(parentB, "Primer movimiento", parentA, userId, now);
        var secondResult = variant.ReassignParent(null, "Segundo movimiento a producto individual", parentB, userId, now.AddMinutes(5));

        secondResult.IsSuccess.Should().BeTrue();
        variant.ParentId.Should().BeNull();

        using var doc = JsonDocument.Parse(variant.CustomAttributesJson);
        doc.RootElement.TryGetProperty("parent_reassignment_history", out var historyEl).Should().BeTrue();
        historyEl.GetArrayLength().Should().Be(2);

        var secondEntry = historyEl[1];
        secondEntry.GetProperty("reason").GetString().Should().Be("Segundo movimiento a producto individual");
        secondEntry.GetProperty("previous_parent_id").GetString().Should().Be(parentB.Id.ToString());
        secondEntry.GetProperty("target_parent_id").GetString().Should().BeNull();
    }

    [Fact(DisplayName = "ReassignParent rechaza motivo vacío o en blanco")]
    public void ReassignParent_EmptyReason_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();
        var parentA = CatalogTestFactory.MatrixParent(tenantId: tenantId);
        var parentB = CatalogTestFactory.MatrixParent(tenantId: tenantId);
        var variant = CatalogTestFactory.VariantChild(parentA);

        var result = variant.ReassignParent(parentB, "   ", parentA, null, DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.reassign.reason_required");
    }

    [Fact(DisplayName = "ReassignParent rechaza motivo que excede 500 caracteres")]
    public void ReassignParent_ReasonTooLong_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();
        var parentA = CatalogTestFactory.MatrixParent(tenantId: tenantId);
        var parentB = CatalogTestFactory.MatrixParent(tenantId: tenantId);
        var variant = CatalogTestFactory.VariantChild(parentA);

        var longReason = new string('x', 501);
        var result = variant.ReassignParent(parentB, longReason, parentA, null, DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.reassign.reason_length");
    }

    [Fact(DisplayName = "ReassignParent rechaza asignarse a sí mismo como padre")]
    public void ReassignParent_SelfParent_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();
        var parent = CatalogTestFactory.MatrixParent(tenantId: tenantId);

        var result = parent.ReassignParent(parent, "Asignar a sí mismo", null, null, DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.reassign.self_parent");
    }

    [Fact(DisplayName = "ReassignParent rechaza producto destino de otra empresa")]
    public void ReassignParent_CrossTenant_ReturnsValidationError()
    {
        var parentA = CatalogTestFactory.MatrixParent(tenantId: Guid.CreateVersion7());
        var parentB = CatalogTestFactory.MatrixParent(tenantId: Guid.CreateVersion7());
        var variant = CatalogTestFactory.VariantChild(parentA);

        var result = variant.ReassignParent(parentB, "Intento cross tenant", parentA, null, DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.reassign.cross_tenant");
    }

    [Fact(DisplayName = "ReassignParent rechaza si el destino no es un producto matriz")]
    public void ReassignParent_TargetNotMatrix_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();
        var parentA = CatalogTestFactory.MatrixParent(tenantId: tenantId);
        var simpleTarget = CatalogTestFactory.Physical(tenantId: tenantId, sku: "SIM-01");
        var variant = CatalogTestFactory.VariantChild(parentA);

        var result = variant.ReassignParent(simpleTarget, "Destino simple", parentA, null, DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.reassign.target_not_matrix");
    }

    [Fact(DisplayName = "ReassignParent rechaza si ya está asignado al mismo padre")]
    public void ReassignParent_AlreadyParent_ReturnsValidationError()
    {
        var tenantId = Guid.CreateVersion7();
        var parent = CatalogTestFactory.MatrixParent(tenantId: tenantId);
        var variant = CatalogTestFactory.VariantChild(parent);

        var result = variant.ReassignParent(parent, "Mismo padre", parent, null, DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.reassign.already_parent");
    }

    [Fact(DisplayName = "ReassignParent rechaza desenlazar un producto que ya es standalone")]
    public void ReassignParent_AlreadyStandalone_ReturnsValidationError()
    {
        var item = CatalogTestFactory.Physical();

        var result = item.ReassignParent(null, "Ya era standalone", null, null, DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.reassign.already_standalone");
    }

    [Fact(DisplayName = "Update preserva el historial de auditoría de reasignación")]
    public void Update_PreservesParentReassignmentHistory()
    {
        var tenantId = Guid.CreateVersion7();
        var parentA = CatalogTestFactory.MatrixParent(tenantId: tenantId, name: "Matriz A", sku: "MAT-A");
        var parentB = CatalogTestFactory.MatrixParent(tenantId: tenantId, name: "Matriz B", sku: "MAT-B");
        var variant = CatalogTestFactory.VariantChild(parentA, sku: "VAR-PRESERVE");

        variant.ReassignParent(parentB, "Motivo auditoría", parentA, null, DateTimeOffset.UtcNow);

        // Actualizamos detalles con nuevo JSON de atributos comerciales
        var updateResult = variant.Update(
            "Nombre Actualizado",
            "Nueva descripción",
            variant.Sku,
            25m,
            null,
            """{"color":"Rojo","material":"Algodón"}""",
            CatalogAttributeSchema.EmptyArrayJson,
            null);

        updateResult.IsSuccess.Should().BeTrue();

        using var doc = JsonDocument.Parse(variant.CustomAttributesJson);
        doc.RootElement.GetProperty("color").GetString().Should().Be("Rojo");
        doc.RootElement.GetProperty("material").GetString().Should().Be("Algodón");
        doc.RootElement.TryGetProperty("parent_reassignment_history", out var historyEl).Should().BeTrue();
        historyEl.GetArrayLength().Should().Be(1);
    }
}
