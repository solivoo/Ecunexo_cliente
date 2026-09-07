using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Warehousing;

public sealed class DefaultWarehouseProvisionerTests
{
    [Fact(DisplayName = "Con cupo de 1 bodega crea solo Principal")]
    public async Task EnsureAsync_SingleWarehousePlan_CreatesMainOnly()
    {
        var tenantId = Guid.CreateVersion7();
        var (sut, warehouses, unitOfWork) = CreateSut(tenantId, maxWarehouses: 1);

        await sut.EnsureAsync(tenantId, CancellationToken.None);

        await warehouses.Received(1).AddAsync(Arg.Any<Warehouse>(), Arg.Any<CancellationToken>());
        await unitOfWork.Received(1).TrySaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Si ya hay principal y tránsito no inserta")]
    public async Task EnsureAsync_BothExist_DoesNotSave()
    {
        var tenantId = Guid.CreateVersion7();
        var (sut, warehouses, unitOfWork) = CreateSut(tenantId, maxWarehouses: 5);
        warehouses.HasMainAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        warehouses.HasSystemRoleAsync(tenantId, WarehouseSystemRole.Transit, Arg.Any<CancellationToken>())
            .Returns(true);

        await sut.EnsureAsync(tenantId, CancellationToken.None);

        await warehouses.DidNotReceive().AddAsync(Arg.Any<Warehouse>(), Arg.Any<CancellationToken>());
        await unitOfWork.DidNotReceive().TrySaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Adopta Principal ya creada (mismo código) en vez de insertar otra")]
    public async Task EnsureAsync_ExistingPrincipalCode_DesignatesAsMain()
    {
        var tenantId = Guid.CreateVersion7();
        var existing = Warehouse.Create(
            Guid.CreateVersion7(),
            tenantId,
            Warehouse.MainDefaultName,
            code: Warehouse.MainDefaultCode,
            isMain: false).Value!;
        var (sut, warehouses, unitOfWork) = CreateSut(tenantId, maxWarehouses: 5);
        warehouses.HasMainAsync(tenantId, Arg.Any<CancellationToken>()).Returns(false);
        warehouses.HasSystemRoleAsync(tenantId, WarehouseSystemRole.Transit, Arg.Any<CancellationToken>())
            .Returns(true);
        warehouses
            .GetTrackedByCodeIgnoreCaseAsync(tenantId, Warehouse.MainDefaultCode, Arg.Any<CancellationToken>())
            .Returns(existing);

        await sut.EnsureAsync(tenantId, CancellationToken.None);

        existing.IsMain.Should().BeTrue();
        await warehouses.DidNotReceive().AddAsync(Arg.Any<Warehouse>(), Arg.Any<CancellationToken>());
        await unitOfWork.Received(1).TrySaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Con cupo > 1 y sin bodegas crea Principal y En tránsito")]
    public async Task EnsureAsync_MultiWarehousePlan_AddsBoth()
    {
        var tenantId = Guid.CreateVersion7();
        var (sut, warehouses, unitOfWork) = CreateSut(tenantId, maxWarehouses: 5);
        warehouses.HasMainAsync(tenantId, Arg.Any<CancellationToken>()).Returns(false);
        warehouses.HasSystemRoleAsync(tenantId, WarehouseSystemRole.Transit, Arg.Any<CancellationToken>())
            .Returns(false);

        await sut.EnsureAsync(tenantId, CancellationToken.None);

        await warehouses.Received(2).AddAsync(Arg.Any<Warehouse>(), Arg.Any<CancellationToken>());
        await unitOfWork.Received(1).TrySaveChangesAsync(Arg.Any<CancellationToken>());
    }

    private static (DefaultWarehouseProvisioner Sut, IWarehouseRepository Warehouses, IUnitOfWork UnitOfWork)
        CreateSut(Guid tenantId, int maxWarehouses)
    {
        var tenant = Tenant.Create(
            tenantId,
            "Andes test",
            new ServicePlan("Business", 10, maxWarehouses),
            enabledModuleCodes: ["identity", "catalog", "inventory", "warehousing"]).Value!;
        var tenants = Substitute.For<ITenantRepository>();
        tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns(_ => Guid.CreateVersion7());
        var warehouses = Substitute.For<IWarehouseRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        unitOfWork.TrySaveChangesAsync(Arg.Any<CancellationToken>()).Returns(true);
        return (new DefaultWarehouseProvisioner(idGenerator, tenants, warehouses, unitOfWork), warehouses, unitOfWork);
    }
}
