using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Queries.ListTenantDepartments;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.GetTenantDepartment;

public sealed class GetTenantDepartmentHandler
    : IQueryHandler<GetTenantDepartmentQuery, DepartmentListItemResponse>
{
    private readonly IDepartmentRepository _departments;

    public GetTenantDepartmentHandler(IDepartmentRepository departments)
    {
        _departments = departments;
    }

    public async Task<Result<DepartmentListItemResponse>> Handle(
        GetTenantDepartmentQuery query,
        CancellationToken ct)
    {
        var department = await _departments
            .GetActiveByIdAsync(query.TenantId, query.DepartmentId, ct)
            .ConfigureAwait(false);
        if (department is null)
        {
            return Result.Failure<DepartmentListItemResponse>(
                new Error("department.not_found", "El departamento no existe.", ErrorType.NotFound));
        }

        return Result.Success(
            new DepartmentListItemResponse(
                department.Id,
                department.Name,
                department.Description,
                department.CreatedAt));
    }
}
