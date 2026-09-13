using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Accounting.Commands.SeedStandardEcuadorPlan;

public sealed record SeedStandardEcuadorPlanCommand(
    Guid TenantId,
    Guid? UserId = null) : ICommand<int>;
