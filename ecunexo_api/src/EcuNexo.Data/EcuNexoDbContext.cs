using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Customers;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Platform;
using EcuNexo.Core.Platform.Navigation;
using EcuNexo.Core.Repairs;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data;

public sealed class EcuNexoDbContext : DbContext
{
    private readonly ITenantContext _tenantContext;

    public EcuNexoDbContext(DbContextOptions<EcuNexoDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<ActivationCode> ActivationCodes => Set<ActivationCode>();

    public DbSet<LicenseRedemption> LicenseRedemptions => Set<LicenseRedemption>();

    public DbSet<SubscriptionAccount> SubscriptionAccounts => Set<SubscriptionAccount>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Role> Roles => Set<Role>();

    public DbSet<Department> Departments => Set<Department>();

    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public DbSet<Permission> Permissions => Set<Permission>();

    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    public DbSet<Policy> Policies => Set<Policy>();

    public DbSet<SysSetting> SysSettings => Set<SysSetting>();

    public DbSet<MenuItem> MenuItems => Set<MenuItem>();

    public DbSet<ProductModule> ProductModules => Set<ProductModule>();

    public DbSet<ModuleUsageCounter> ModuleUsageCounters => Set<ModuleUsageCounter>();

    public DbSet<TenantBrandLogo> TenantBrandLogos => Set<TenantBrandLogo>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<CatalogItem> CatalogItems => Set<CatalogItem>();

    public DbSet<Warehouse> Warehouses => Set<Warehouse>();

    public DbSet<Stock> Stocks => Set<Stock>();

    public DbSet<InventoryDocument> InventoryDocuments => Set<InventoryDocument>();

    public DbSet<InventoryDocumentLine> InventoryDocumentLines => Set<InventoryDocumentLine>();

    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();

    public DbSet<InvoiceStockEgress> InvoiceStockEgresses => Set<InvoiceStockEgress>();

    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<CustomerTypeDefinition> CustomerTypeDefinitions => Set<CustomerTypeDefinition>();

    public DbSet<RepairBatchTemplate> RepairBatchTemplates => Set<RepairBatchTemplate>();

    public DbSet<RepairBatch> RepairBatches => Set<RepairBatch>();

    public DbSet<RepairEquipment> RepairEquipments => Set<RepairEquipment>();

    public DbSet<RepairEquipmentPhoto> RepairEquipmentPhotos => Set<RepairEquipmentPhoto>();

    public DbSet<RepairEquipmentEvent> RepairEquipmentEvents => Set<RepairEquipmentEvent>();

    public DbSet<RepairDispatch> RepairDispatches => Set<RepairDispatch>();

    public DbSet<RepairDispatchItem> RepairDispatchItems => Set<RepairDispatchItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(EcuNexoDbContext).Assembly);

        modelBuilder.Entity<User>().HasQueryFilter(
            u => (!_tenantContext.CurrentTenantId.HasValue || u.TenantId == _tenantContext.CurrentTenantId)
                 && u.DeletedAt == null);

        modelBuilder.Entity<Role>().HasQueryFilter(
            r => (!_tenantContext.CurrentTenantId.HasValue || r.TenantId == _tenantContext.CurrentTenantId)
                 && r.DeletedAt == null);

        modelBuilder.Entity<UserRole>().HasQueryFilter(
            ur => !_tenantContext.CurrentTenantId.HasValue || ur.TenantId == _tenantContext.CurrentTenantId);

        modelBuilder.Entity<Permission>().HasQueryFilter(p => p.DeletedAt == null);

        modelBuilder.Entity<RolePermission>().HasQueryFilter(
            rp => !_tenantContext.CurrentTenantId.HasValue
                  || rp.Role.TenantId == _tenantContext.CurrentTenantId);

        modelBuilder.Entity<Policy>().HasQueryFilter(p => p.Permission.DeletedAt == null);
    }
}
