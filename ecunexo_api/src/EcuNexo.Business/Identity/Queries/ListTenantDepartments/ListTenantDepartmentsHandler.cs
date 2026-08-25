using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.ListTenantDepartments;

public sealed class ListTenantDepartmentsHandler
    : IQueryHandler<ListTenantDepartmentsQuery, IReadOnlyList<DepartmentListItemResponse>>
{
    private readonly IDepartmentRepository _departments;

    public ListTenantDepartmentsHandler(IDepartmentRepository departments)
    {
        _departments = departments;
    }

    public async Task<Result<IReadOnlyList<DepartmentListItemResponse>>> Handle(
        ListTenantDepartmentsQuery query,
        CancellationToken ct)
    {
        var list = await _departments.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        IReadOnlyList<DepartmentListItemResponse> items = list
            .Select(d => new DepartmentListItemResponse(d.Id, d.Name, d.Description, d.CreatedAt))
            .ToList();
        return Result.Success(items);
    }
}
