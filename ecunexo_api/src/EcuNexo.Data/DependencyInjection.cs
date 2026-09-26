using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.CreditNotes;
using EcuNexo.Data.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace EcuNexo.Data;

public static class DependencyInjection
{
    public static IServiceCollection AddData(this IServiceCollection services, string connectionString)
    {
        services.AddScoped<ITenantContext, ScopedTenantContext>();

        services.AddDbContext<EcuNexoDbContext>(opts =>
        {
            opts.UseNpgsql(connectionString, npg =>
                {
                    npg.ConfigureDataSource(ds => ds.EnableDynamicJson())
                       .MigrationsHistoryTable("__ef_migrations_history", "tenancy");
                })
                .UseSnakeCaseNamingConvention()
                .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
        });

        services.AddScoped<IIdGenerator, UuidV7Generator>();
        services.AddScoped<ITenantRepository, TenantRepository>();
        services.AddScoped<ITenantBrandLogoRepository, TenantBrandLogoRepository>();
        services.AddScoped<EcuNexo.Business.Tenancy.Certificates.ITenantSigningCertificateRepository, TenantSigningCertificateRepository>();
        services.AddScoped<IActivationCodeRepository, ActivationCodeRepository>();
        services.AddScoped<ILicenseRedemptionRepository, LicenseRedemptionRepository>();
        services.AddScoped<ISubscriptionAccountRepository, SubscriptionAccountRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IDepartmentRepository, DepartmentRepository>();
        services.AddScoped<IUserRoleRepository, UserRoleRepository>();
        services.AddScoped<IPermissionRepository, PermissionRepository>();
        services.AddScoped<IRolePermissionRepository, RolePermissionRepository>();
        services.AddScoped<IPolicyRepository, PolicyRepository>();
        services.AddScoped<IUserPermissionQuery, UserPermissionQuery>();
        services.AddScoped<ISysSettingRepository, SysSettingRepository>();
        services.AddScoped<IMenuItemRepository, MenuItemRepository>();
        services.AddScoped<IModuleUsageCounterRepository, ModuleUsageCounterRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<ICatalogItemRepository, CatalogItemRepository>();
        services.AddScoped<IStorefrontCatalogRepository, StorefrontCatalogRepository>();
        services.AddScoped<IStorefrontDomainRepository, StorefrontDomainRepository>();
        services.AddScoped<IVariantDimensionTemplateRepository, VariantDimensionTemplateRepository>();
        services.AddScoped<IProductTemplateRepository, ProductTemplateRepository>();
        services.AddScoped<IWarehouseRepository, WarehouseRepository>();
        services.AddScoped<IStockRepository, StockRepository>();
        services.AddScoped<IInventoryDocumentRepository, InventoryDocumentRepository>();
        services.AddScoped<IInventoryMovementRepository, InventoryMovementRepository>();
        services.AddScoped<IInvoiceStockEgressRepository, InvoiceStockEgressRepository>();
        services.AddScoped<IPriceListRepository, PriceListRepository>();
        services.AddScoped<IProductPriceRepository, ProductPriceRepository>();
        services.AddScoped<IPromotionRepository, PromotionRepository>();
        services.AddScoped<IPriceChangeLogRepository, PriceChangeLogRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<ICustomerTypeDefinitionRepository, CustomerTypeDefinitionRepository>();
        services.AddScoped<ICustomerRepairRateCardRepository, CustomerRepairRateCardRepository>();
        services.AddScoped<IRepairBatchTemplateRepository, RepairBatchTemplateRepository>();
        services.AddScoped<IRepairBatchRepository, RepairBatchRepository>();
        services.AddScoped<IRepairEquipmentRepository, RepairEquipmentRepository>();
        services.AddScoped<IRepairDispatchRepository, RepairDispatchRepository>();
        services.AddScoped<IEcommerceOrderRepository, EcommerceOrderRepository>();
        services.AddScoped<ISupplierRepository, SupplierRepository>();
        services.AddScoped<IExpenseTypeRepository, ExpenseTypeRepository>();
        services.AddScoped<IPurchaseProformaRepository, PurchaseProformaRepository>();
        services.AddScoped<IPurchaseRepository, PurchaseRepository>();
        services.AddScoped<IAccountRepository, AccountRepository>();
        services.AddScoped<IJournalEntryRepository, JournalEntryRepository>();
        services.AddScoped<EcuNexo.Business.RemisionGuides.IRemisionGuideRepository, RemisionGuideRepository>();
        services.AddScoped<ICreditNoteRepository, CreditNoteRepository>();
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();

        return services;
    }
}
