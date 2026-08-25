using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Queries.ListTenantDepartments;

public sealed record ListTenantDepartmentsQuery(Guid TenantId)
    : IQuery<IReadOnlyList<DepartmentListItemResponse>>;

public sealed record DepartmentListItemResponse(
    Guid Id,
    string Name,
    string? Description,
    DateTimeOffset CreatedAt);
