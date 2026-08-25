using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Queries.ListTenantDepartments;

namespace EcuNexo.Business.Identity.Queries.GetTenantDepartment;

public sealed record GetTenantDepartmentQuery(Guid TenantId, Guid DepartmentId)
    : IQuery<DepartmentListItemResponse>;
