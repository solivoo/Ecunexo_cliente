namespace EcuNexo.Business.Platform.Queries.GetDashboardAnalytics;

public sealed record DashboardAnalyticsDto(
    IReadOnlyList<SalesMonthlyTrendDto> SalesMonthlyTrend,
    IReadOnlyList<StatusDistributionDto> SriStatusDistribution,
    IReadOnlyList<CustomerTypeDistributionDto> CustomerTypeDistribution,
    IReadOnlyList<PurchasesExpensesTrendDto> PurchasesExpensesTrend,
    IReadOnlyList<WarehouseStockDistributionDto> WarehouseStockDistribution,
    IReadOnlyList<StatusDistributionDto> RemisionGuidesStatus,
    IReadOnlyList<StatusDistributionDto> RepairStagesDistribution,
    IReadOnlyList<FinancialBalanceDto> FinancialBalance,
    IReadOnlyList<TaxDeclarationTrendDto> TaxDeclarationsTrend
);

public sealed record SalesMonthlyTrendDto(string Mes, decimal Ventas, int Comprobantes);
public sealed record StatusDistributionDto(string Name, int Value, string? Color = null);
public sealed record CustomerTypeDistributionDto(string Tipo, int Cantidad);
public sealed record PurchasesExpensesTrendDto(string Mes, decimal Inventario, decimal Servicios);
public sealed record WarehouseStockDistributionDto(string Bodega, int StockFisico, int StockMinimo);
public sealed record FinancialBalanceDto(string Rubro, decimal Monto);
public sealed record TaxDeclarationTrendDto(string Mes, decimal IvaCobrado, decimal IvaSoportado, decimal Retenciones);
