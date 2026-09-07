using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class InitialCreate : Migration
{
    private static readonly string[] CategoriesTenantIdNameIndexColumns = ["tenant_id", "name"];
    private static readonly string[] CategoriesTenantIdParentIdIndexColumns = ["tenant_id", "parent_id"];
    private static readonly string[] DepartmentsTenantIdNameIndexColumns = ["tenant_id", "name"];
    private static readonly string[] DocumentsTenantIdStatusCreatedAtIndexColumns = ["tenant_id", "status", "created_at"];
    private static readonly string[] InvoiceStockEgressesTenantIdBillingInvoiceIdIndexColumns = ["tenant_id", "billing_invoice_id"];
    private static readonly string[] ItemsTenantIdKindNameIndexColumns = ["tenant_id", "kind", "name"];
    private static readonly string[] ItemsTenantIdSkuIndexColumns = ["tenant_id", "sku"];
    private static readonly string[] MenuItemsContextModuleCodeSortOrderIndexColumns = ["context", "module_code", "sort_order"];
    private static readonly string[] ModuleUsageCountersTenantModuleLimitIndexColumns = ["tenant_id", "module_code", "limit_key"];
    private static readonly string[] MovementsTenantIdCatalogItemIdWarehouseIdOccurredAtIndexColumns = ["tenant_id", "catalog_item_id", "warehouse_id", "occurred_at"];
    private static readonly string[] MovementsTenantIdOccurredAtIndexColumns = ["tenant_id", "occurred_at"];
    private static readonly string[] RolesTenantIdNameIndexColumns = ["tenant_id", "name"];
    private static readonly string[] StocksTenantIdCatalogItemIdWarehouseIdIndexColumns = ["tenant_id", "catalog_item_id", "warehouse_id"];
    private static readonly string[] StocksTenantIdWarehouseIdIndexColumns = ["tenant_id", "warehouse_id"];
    private static readonly string[] SysSettingsCodeScopeScopeIdIndexColumns = ["code", "scope", "scope_id"];
    private static readonly string[] UsersTenantIdEmailIndexColumns = ["tenant_id", "email"];
    private static readonly string[] WarehousesTenantIdCodeIndexColumns = ["tenant_id", "code"];
    private static readonly string[] WarehousesTenantIdIsMainIndexColumns = ["tenant_id", "is_main"];
    private static readonly string[] WarehousesTenantIdNameIndexColumns = ["tenant_id", "name"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "tenancy");

        migrationBuilder.EnsureSchema(
            name: "catalog");

        migrationBuilder.EnsureSchema(
            name: "identity");

        migrationBuilder.EnsureSchema(
            name: "inventory");

        migrationBuilder.EnsureSchema(
            name: "platform");

        migrationBuilder.EnsureSchema(
            name: "warehousing");

        migrationBuilder.CreateTable(
            name: "activation_codes",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                code_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                plan_label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                max_tenants = table.Column<int>(type: "integer", nullable: false),
                max_users = table.Column<int>(type: "integer", nullable: false),
                max_warehouses = table.Column<int>(type: "integer", nullable: false),
                enabled_module_codes = table.Column<string>(type: "jsonb", nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                provisioning_slots_remaining = table.Column<int>(type: "integer", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                consumed_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                consumed_by_tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_activation_codes", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "license_redemptions",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                subscription_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                redeemed_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_license_redemptions", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "menu_items",
            schema: "platform",
            columns: table => new
            {
                id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                parent_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                icon = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                route = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                sort_order = table.Column<int>(type: "integer", nullable: false),
                context = table.Column<int>(type: "integer", nullable: false),
                module_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                position = table.Column<int>(type: "integer", nullable: false),
                required_permissions = table.Column<string>(type: "jsonb", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                is_placeholder = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_menu_items", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "module_usage_counters",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                module_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                limit_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                current_value = table.Column<int>(type: "integer", nullable: false),
                period_start_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                period_end_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_module_usage_counters", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "permissions",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                module = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                sort_order = table.Column<int>(type: "integer", nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                status = table.Column<int>(type: "integer", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_permissions", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "product_modules",
            schema: "platform",
            columns: table => new
            {
                code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                display_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_product_modules", x => x.code);
            });

        migrationBuilder.CreateTable(
            name: "subscription_accounts",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                grant_id = table.Column<Guid>(type: "uuid", nullable: false),
                email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                department = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                job_title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                password_hash = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                subscription_max_tenants = table.Column<int>(type: "integer", nullable: false),
                enabled_modules = table.Column<string>(type: "jsonb", nullable: true),
                module_entitlements = table.Column<IReadOnlyList<ModuleEntitlement>>(type: "jsonb", nullable: true),
                subscription_group_id = table.Column<Guid>(type: "uuid", nullable: false),
                license_expires_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                online_validation_interval_days = table.Column<int>(type: "integer", nullable: false, defaultValue: 30),
                last_online_license_validation_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                last_login_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                plan_max_users = table.Column<int>(type: "integer", nullable: false),
                plan_max_warehouses = table.Column<int>(type: "integer", nullable: false),
                plan_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_subscription_accounts", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "sys_settings",
            schema: "platform",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                value = table.Column<string>(type: "jsonb", nullable: false),
                scope = table.Column<int>(type: "integer", nullable: false),
                scope_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_sys_settings", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "tenants",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                time_zone_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                locale = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                logo_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                logo_light_id = table.Column<Guid>(type: "uuid", nullable: true),
                logo_dark_id = table.Column<Guid>(type: "uuid", nullable: true),
                prefer_wordmark = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                primary_color_hex = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: true),
                tax_id = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: true),
                legal_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                city = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                establishment_code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                contact_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                contact_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                ride_thank_you_text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                accounting_required = table.Column<bool>(type: "boolean", nullable: false),
                rimpe_kind = table.Column<int>(type: "integer", nullable: false),
                is_rimpe = table.Column<bool>(type: "boolean", nullable: false),
                prefer_electronic_invoice = table.Column<bool>(type: "boolean", nullable: false),
                is_exporter = table.Column<bool>(type: "boolean", nullable: false),
                is_large_taxpayer = table.Column<bool>(type: "boolean", nullable: false),
                is_special_taxpayer = table.Column<bool>(type: "boolean", nullable: false),
                is_withholding_agent = table.Column<bool>(type: "boolean", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                subscription_group_id = table.Column<Guid>(type: "uuid", nullable: false),
                subscription_max_tenants = table.Column<int>(type: "integer", nullable: false),
                enabled_modules = table.Column<string>(type: "jsonb", nullable: true),
                module_entitlements = table.Column<IReadOnlyList<ModuleEntitlement>>(type: "jsonb", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                plan_max_users = table.Column<int>(type: "integer", nullable: false),
                plan_max_warehouses = table.Column<int>(type: "integer", nullable: false),
                plan_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_tenants", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "policies",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                permission_id = table.Column<Guid>(type: "uuid", nullable: false),
                effect = table.Column<int>(type: "integer", nullable: false),
                condition = table.Column<string>(type: "text", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_policies", x => x.id);
                table.ForeignKey(
                    name: "fk_policies_permissions_permission_id",
                    column: x => x.permission_id,
                    principalSchema: "identity",
                    principalTable: "permissions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "categories",
            schema: "catalog",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                attribute_schema_json = table.Column<string>(type: "jsonb", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_categories", x => x.id);
                table.ForeignKey(
                    name: "fk_categories_categories_parent_id",
                    column: x => x.parent_id,
                    principalSchema: "catalog",
                    principalTable: "categories",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_categories_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "departments",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_departments", x => x.id);
                table.ForeignKey(
                    name: "fk_departments_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "invoice_stock_egresses",
            schema: "inventory",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                billing_invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                inventory_document_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_invoice_stock_egresses", x => x.id);
                table.ForeignKey(
                    name: "fk_invoice_stock_egresses_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "roles",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                is_system = table.Column<bool>(type: "boolean", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_roles", x => x.id);
                table.ForeignKey(
                    name: "fk_roles_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "tenant_brand_logos",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                original_file_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                extension = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                content_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                byte_size = table.Column<int>(type: "integer", nullable: false),
                image_bytes = table.Column<byte[]>(type: "bytea", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_tenant_brand_logos", x => x.id);
                table.ForeignKey(
                    name: "fk_tenant_brand_logos_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "warehouses",
            schema: "warehousing",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                address_json = table.Column<string>(type: "jsonb", nullable: false),
                is_main = table.Column<bool>(type: "boolean", nullable: false),
                is_system = table.Column<bool>(type: "boolean", nullable: false),
                system_role = table.Column<int>(type: "integer", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_warehouses", x => x.id);
                table.ForeignKey(
                    name: "fk_warehouses_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "items",
            schema: "catalog",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                category_id = table.Column<Guid>(type: "uuid", nullable: true),
                kind = table.Column<int>(type: "integer", nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                sku = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                base_price = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                custom_attributes_json = table.Column<string>(type: "jsonb", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_items", x => x.id);
                table.ForeignKey(
                    name: "fk_items_categories_category_id",
                    column: x => x.category_id,
                    principalSchema: "catalog",
                    principalTable: "categories",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_items_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "users",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                department = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                department_id = table.Column<Guid>(type: "uuid", nullable: true),
                phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                job_title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                password_hash = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                last_login_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                is_disabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_users", x => x.id);
                table.ForeignKey(
                    name: "fk_users_departments_department_id",
                    column: x => x.department_id,
                    principalSchema: "identity",
                    principalTable: "departments",
                    principalColumn: "id",
                    onDelete: ReferentialAction.SetNull);
                table.ForeignKey(
                    name: "fk_users_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "role_permissions",
            schema: "identity",
            columns: table => new
            {
                role_id = table.Column<Guid>(type: "uuid", nullable: false),
                permission_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_role_permissions", x => new { x.role_id, x.permission_id });
                table.ForeignKey(
                    name: "fk_role_permissions_permissions_permission_id",
                    column: x => x.permission_id,
                    principalSchema: "identity",
                    principalTable: "permissions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_role_permissions_roles_role_id",
                    column: x => x.role_id,
                    principalSchema: "identity",
                    principalTable: "roles",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "documents",
            schema: "inventory",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                document_type = table.Column<int>(type: "integer", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                warehouse_id = table.Column<Guid>(type: "uuid", nullable: false),
                destination_warehouse_id = table.Column<Guid>(type: "uuid", nullable: true),
                notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                receipt_origin = table.Column<int>(type: "integer", nullable: true),
                source_document_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                approved_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                approved_by = table.Column<Guid>(type: "uuid", nullable: true),
                shipped_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                shipped_by = table.Column<Guid>(type: "uuid", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_documents", x => x.id);
                table.ForeignKey(
                    name: "fk_documents_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_documents_warehouses_destination_warehouse_id",
                    column: x => x.destination_warehouse_id,
                    principalSchema: "warehousing",
                    principalTable: "warehouses",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_documents_warehouses_warehouse_id",
                    column: x => x.warehouse_id,
                    principalSchema: "warehousing",
                    principalTable: "warehouses",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "stocks",
            schema: "inventory",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                catalog_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                warehouse_id = table.Column<Guid>(type: "uuid", nullable: false),
                quantity = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                minimum_quantity = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_stocks", x => x.id);
                table.ForeignKey(
                    name: "fk_stocks_catalog_items_catalog_item_id",
                    column: x => x.catalog_item_id,
                    principalSchema: "catalog",
                    principalTable: "items",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_stocks_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_stocks_warehouses_warehouse_id",
                    column: x => x.warehouse_id,
                    principalSchema: "warehousing",
                    principalTable: "warehouses",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "user_roles",
            schema: "identity",
            columns: table => new
            {
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                role_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_user_roles", x => new { x.tenant_id, x.user_id, x.role_id });
                table.ForeignKey(
                    name: "fk_user_roles_roles_role_id",
                    column: x => x.role_id,
                    principalSchema: "identity",
                    principalTable: "roles",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_user_roles_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_user_roles_users_user_id",
                    column: x => x.user_id,
                    principalSchema: "identity",
                    principalTable: "users",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "document_lines",
            schema: "inventory",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                document_id = table.Column<Guid>(type: "uuid", nullable: false),
                catalog_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                quantity = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_document_lines", x => x.id);
                table.ForeignKey(
                    name: "fk_document_lines_documents_document_id",
                    column: x => x.document_id,
                    principalSchema: "inventory",
                    principalTable: "documents",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "fk_document_lines_items_catalog_item_id",
                    column: x => x.catalog_item_id,
                    principalSchema: "catalog",
                    principalTable: "items",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "movements",
            schema: "inventory",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                catalog_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                warehouse_id = table.Column<Guid>(type: "uuid", nullable: false),
                document_id = table.Column<Guid>(type: "uuid", nullable: false),
                direction = table.Column<int>(type: "integer", nullable: false),
                quantity = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                occurred_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_movements", x => x.id);
                table.ForeignKey(
                    name: "fk_movements_documents_document_id",
                    column: x => x.document_id,
                    principalSchema: "inventory",
                    principalTable: "documents",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_movements_items_catalog_item_id",
                    column: x => x.catalog_item_id,
                    principalSchema: "catalog",
                    principalTable: "items",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_movements_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_movements_warehouses_warehouse_id",
                    column: x => x.warehouse_id,
                    principalSchema: "warehousing",
                    principalTable: "warehouses",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_activation_codes_code_hash",
            schema: "tenancy",
            table: "activation_codes",
            column: "code_hash",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_categories_parent_id",
            schema: "catalog",
            table: "categories",
            column: "parent_id");

        migrationBuilder.CreateIndex(
            name: "ix_categories_tenant_id_name",
            schema: "catalog",
            table: "categories",
            columns: CategoriesTenantIdNameIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL");

        migrationBuilder.CreateIndex(
            name: "ix_categories_tenant_id_parent_id",
            schema: "catalog",
            table: "categories",
            columns: CategoriesTenantIdParentIdIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_departments_tenant_id_name",
            schema: "identity",
            table: "departments",
            columns: DepartmentsTenantIdNameIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL");

        migrationBuilder.CreateIndex(
            name: "ix_document_lines_catalog_item_id",
            schema: "inventory",
            table: "document_lines",
            column: "catalog_item_id");

        migrationBuilder.CreateIndex(
            name: "ix_document_lines_document_id",
            schema: "inventory",
            table: "document_lines",
            column: "document_id");

        migrationBuilder.CreateIndex(
            name: "ix_documents_destination_warehouse_id",
            schema: "inventory",
            table: "documents",
            column: "destination_warehouse_id");

        migrationBuilder.CreateIndex(
            name: "ix_documents_tenant_id_status_created_at",
            schema: "inventory",
            table: "documents",
            columns: DocumentsTenantIdStatusCreatedAtIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_documents_warehouse_id",
            schema: "inventory",
            table: "documents",
            column: "warehouse_id");

        migrationBuilder.CreateIndex(
            name: "ix_invoice_stock_egresses_tenant_id_billing_invoice_id",
            schema: "inventory",
            table: "invoice_stock_egresses",
            columns: InvoiceStockEgressesTenantIdBillingInvoiceIdIndexColumns,
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_items_category_id",
            schema: "catalog",
            table: "items",
            column: "category_id");

        migrationBuilder.CreateIndex(
            name: "ix_items_tenant_id_kind_name",
            schema: "catalog",
            table: "items",
            columns: ItemsTenantIdKindNameIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_items_tenant_id_sku",
            schema: "catalog",
            table: "items",
            columns: ItemsTenantIdSkuIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL AND sku IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "ix_license_redemptions_subscription_account_id",
            schema: "tenancy",
            table: "license_redemptions",
            column: "subscription_account_id");

        migrationBuilder.CreateIndex(
            name: "ix_menu_items_context_module_code_sort_order",
            schema: "platform",
            table: "menu_items",
            columns: MenuItemsContextModuleCodeSortOrderIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_module_usage_counters_tenant_module_limit",
            schema: "tenancy",
            table: "module_usage_counters",
            columns: ModuleUsageCountersTenantModuleLimitIndexColumns,
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_movements_catalog_item_id",
            schema: "inventory",
            table: "movements",
            column: "catalog_item_id");

        migrationBuilder.CreateIndex(
            name: "ix_movements_document_id",
            schema: "inventory",
            table: "movements",
            column: "document_id");

        migrationBuilder.CreateIndex(
            name: "ix_movements_tenant_id_catalog_item_id_warehouse_id_occurred_at",
            schema: "inventory",
            table: "movements",
            columns: MovementsTenantIdCatalogItemIdWarehouseIdOccurredAtIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_movements_tenant_id_occurred_at",
            schema: "inventory",
            table: "movements",
            columns: MovementsTenantIdOccurredAtIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_movements_warehouse_id",
            schema: "inventory",
            table: "movements",
            column: "warehouse_id");

        migrationBuilder.CreateIndex(
            name: "ix_permissions_code",
            schema: "identity",
            table: "permissions",
            column: "code",
            unique: true,
            filter: "\"deleted_at\" IS NULL");

        migrationBuilder.CreateIndex(
            name: "ix_policies_permission_id",
            schema: "identity",
            table: "policies",
            column: "permission_id");

        migrationBuilder.CreateIndex(
            name: "ix_role_permissions_permission_id",
            schema: "identity",
            table: "role_permissions",
            column: "permission_id");

        migrationBuilder.CreateIndex(
            name: "ix_roles_tenant_id_name",
            schema: "identity",
            table: "roles",
            columns: RolesTenantIdNameIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL");

        migrationBuilder.CreateIndex(
            name: "ix_stocks_catalog_item_id",
            schema: "inventory",
            table: "stocks",
            column: "catalog_item_id");

        migrationBuilder.CreateIndex(
            name: "ix_stocks_tenant_id_catalog_item_id_warehouse_id",
            schema: "inventory",
            table: "stocks",
            columns: StocksTenantIdCatalogItemIdWarehouseIdIndexColumns,
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_stocks_tenant_id_warehouse_id",
            schema: "inventory",
            table: "stocks",
            columns: StocksTenantIdWarehouseIdIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_stocks_warehouse_id",
            schema: "inventory",
            table: "stocks",
            column: "warehouse_id");

        migrationBuilder.CreateIndex(
            name: "ix_subscription_accounts_email",
            schema: "tenancy",
            table: "subscription_accounts",
            column: "email",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_subscription_accounts_grant_id",
            schema: "tenancy",
            table: "subscription_accounts",
            column: "grant_id",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_subscription_accounts_subscription_group_id",
            schema: "tenancy",
            table: "subscription_accounts",
            column: "subscription_group_id");

        migrationBuilder.CreateIndex(
            name: "ix_sys_settings_code_scope_scope_id",
            schema: "platform",
            table: "sys_settings",
            columns: SysSettingsCodeScopeScopeIdIndexColumns,
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_tenant_brand_logos_tenant_id",
            schema: "tenancy",
            table: "tenant_brand_logos",
            column: "tenant_id");

        migrationBuilder.CreateIndex(
            name: "ix_tenants_subscription_group_id",
            schema: "tenancy",
            table: "tenants",
            column: "subscription_group_id");

        migrationBuilder.CreateIndex(
            name: "ix_tenants_tax_id",
            schema: "tenancy",
            table: "tenants",
            column: "tax_id");

        migrationBuilder.CreateIndex(
            name: "ix_user_roles_role_id",
            schema: "identity",
            table: "user_roles",
            column: "role_id");

        migrationBuilder.CreateIndex(
            name: "ix_user_roles_user_id",
            schema: "identity",
            table: "user_roles",
            column: "user_id");

        migrationBuilder.CreateIndex(
            name: "ix_users_department_id",
            schema: "identity",
            table: "users",
            column: "department_id");

        migrationBuilder.CreateIndex(
            name: "ix_users_tenant_id_email",
            schema: "identity",
            table: "users",
            columns: UsersTenantIdEmailIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL");

        migrationBuilder.CreateIndex(
            name: "ix_warehouses_tenant_id_code",
            schema: "warehousing",
            table: "warehouses",
            columns: WarehousesTenantIdCodeIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL AND code IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "ix_warehouses_tenant_id_is_main",
            schema: "warehousing",
            table: "warehouses",
            columns: WarehousesTenantIdIsMainIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL AND is_main = TRUE");

        migrationBuilder.CreateIndex(
            name: "ix_warehouses_tenant_id_name",
            schema: "warehousing",
            table: "warehouses",
            columns: WarehousesTenantIdNameIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "activation_codes",
            schema: "tenancy");

        migrationBuilder.DropTable(
            name: "document_lines",
            schema: "inventory");

        migrationBuilder.DropTable(
            name: "invoice_stock_egresses",
            schema: "inventory");

        migrationBuilder.DropTable(
            name: "license_redemptions",
            schema: "tenancy");

        migrationBuilder.DropTable(
            name: "menu_items",
            schema: "platform");

        migrationBuilder.DropTable(
            name: "module_usage_counters",
            schema: "tenancy");

        migrationBuilder.DropTable(
            name: "movements",
            schema: "inventory");

        migrationBuilder.DropTable(
            name: "policies",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "product_modules",
            schema: "platform");

        migrationBuilder.DropTable(
            name: "role_permissions",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "stocks",
            schema: "inventory");

        migrationBuilder.DropTable(
            name: "subscription_accounts",
            schema: "tenancy");

        migrationBuilder.DropTable(
            name: "sys_settings",
            schema: "platform");

        migrationBuilder.DropTable(
            name: "tenant_brand_logos",
            schema: "tenancy");

        migrationBuilder.DropTable(
            name: "user_roles",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "documents",
            schema: "inventory");

        migrationBuilder.DropTable(
            name: "permissions",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "items",
            schema: "catalog");

        migrationBuilder.DropTable(
            name: "roles",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "users",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "warehouses",
            schema: "warehousing");

        migrationBuilder.DropTable(
            name: "categories",
            schema: "catalog");

        migrationBuilder.DropTable(
            name: "departments",
            schema: "identity");

        migrationBuilder.DropTable(
            name: "tenants",
            schema: "tenancy");
    }
}
