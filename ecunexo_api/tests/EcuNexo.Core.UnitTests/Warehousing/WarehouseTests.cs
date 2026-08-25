using EcuNexo.Core.Warehousing;

namespace EcuNexo.Core.UnitTests.Warehousing;

/// <summary>
/// Prioridad 2 — La bodega en tránsito es de sistema y no admite recepción/egreso directo.
/// </summary>
public sealed class WarehouseTests
{
    [Fact(DisplayName = "Bodega operativa admite EnsureOperational")]
    public void EnsureOperational_MainWarehouse_Succeeds()
    {
        // Preparar
        var warehouse = Warehouse.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Warehouse.MainDefaultName,
            code: Warehouse.MainDefaultCode,
            isMain: true).Value!;

        // Actuar
        var result = warehouse.EnsureOperational();

        // Verificar
        result.IsSuccess.Should().BeTrue();
        warehouse.IsTransit.Should().BeFalse();
    }

    [Fact(DisplayName = "Bodega En tránsito bloquea recepción/egreso directo")]
    public void EnsureOperational_TransitWarehouse_IsLocked()
    {
        // Preparar
        var transit = Warehouse.CreateSystem(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Warehouse.TransitDefaultName,
            WarehouseSystemRole.Transit,
            Warehouse.TransitDefaultCode,
            isMain: false).Value!;

        // Actuar
        var result = transit.EnsureOperational();

        // Verificar
        transit.IsTransit.Should().BeTrue();
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("warehousing.warehouse.transit.locked");
    }

    [Fact(DisplayName = "Bodega operativa admite corregir nombre y dirección")]
    public void UpdateDetails_OperationalWarehouse_Succeeds()
    {
        var warehouse = Warehouse.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Nommbre mal",
            code: "B1").Value!;

        var result = warehouse.UpdateDetails("Sucursal Norte", "NORTE", """{"city":"Quito"}""", updatedBy: null);

        result.IsSuccess.Should().BeTrue();
        warehouse.Name.Should().Be("Sucursal Norte");
        warehouse.Code.Should().Be("NORTE");
        warehouse.AddressJson.Should().Contain("Quito");
    }

    [Fact(DisplayName = "Bodega de sistema no se edita")]
    public void UpdateDetails_SystemWarehouse_IsLocked()
    {
        var transit = Warehouse.CreateSystem(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Warehouse.TransitDefaultName,
            WarehouseSystemRole.Transit,
            Warehouse.TransitDefaultCode,
            isMain: false).Value!;

        var result = transit.UpdateDetails("Otro", "X", "{}", updatedBy: null);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("warehousing.warehouse.system.locked");
        transit.Name.Should().Be(Warehouse.TransitDefaultName);
    }

    [Fact(DisplayName = "Bodega operativa sin IsMain se puede marcar como principal")]
    public void DesignateAsMain_OperationalWarehouse_Succeeds()
    {
        var warehouse = Warehouse.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Warehouse.MainDefaultName,
            code: Warehouse.MainDefaultCode,
            isMain: false).Value!;

        var result = warehouse.DesignateAsMain();

        result.IsSuccess.Should().BeTrue();
        warehouse.IsMain.Should().BeTrue();
    }

    [Fact(DisplayName = "Bodega en tránsito no se marca como principal")]
    public void DesignateAsMain_TransitWarehouse_Fails()
    {
        var transit = Warehouse.CreateSystem(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Warehouse.TransitDefaultName,
            WarehouseSystemRole.Transit,
            Warehouse.TransitDefaultCode,
            isMain: false).Value!;

        var result = transit.DesignateAsMain();

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("warehousing.warehouse.transit.not_main");
        transit.IsMain.Should().BeFalse();
    }

    [Fact(DisplayName = "Bodega operativa se puede adoptar como tránsito")]
    public void DesignateAsSystemTransit_OperationalWarehouse_Succeeds()
    {
        var warehouse = Warehouse.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Warehouse.TransitDefaultName,
            code: Warehouse.TransitDefaultCode).Value!;

        var result = warehouse.DesignateAsSystemTransit();

        result.IsSuccess.Should().BeTrue();
        warehouse.IsTransit.Should().BeTrue();
    }

    [Fact(DisplayName = "Bodega principal no se convierte en tránsito")]
    public void DesignateAsSystemTransit_MainWarehouse_Fails()
    {
        var warehouse = Warehouse.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Warehouse.MainDefaultName,
            code: Warehouse.MainDefaultCode,
            isMain: true).Value!;

        var result = warehouse.DesignateAsSystemTransit();

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("warehousing.warehouse.main.not_transit");
        warehouse.IsTransit.Should().BeFalse();
    }
}
