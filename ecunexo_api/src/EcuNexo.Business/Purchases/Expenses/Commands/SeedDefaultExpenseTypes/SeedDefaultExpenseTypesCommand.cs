using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Expenses.Commands.SeedDefaultExpenseTypes;

public sealed record SeedDefaultExpenseTypesCommand(Guid TenantId) : ICommand<int>;
