using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreatePolicyHandler : ICommandHandler<CreatePolicyCommand, CreatePolicyResponse>
{
    private readonly IValidator<CreatePolicyCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly IPermissionRepository _permissions;
    private readonly IPolicyRepository _policies;
    private readonly IPolicyEvaluator _policyEvaluator;
    private readonly IUnitOfWork _unitOfWork;

    public CreatePolicyHandler(
        IValidator<CreatePolicyCommand> validator,
        IIdGenerator idGenerator,
        IPermissionRepository permissions,
        IPolicyRepository policies,
        IPolicyEvaluator policyEvaluator,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _permissions = permissions;
        _policies = policies;
        _policyEvaluator = policyEvaluator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreatePolicyResponse>> Handle(CreatePolicyCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreatePolicyResponse>(
                new Error("policy.create.validation", message, ErrorType.Validation));
        }

        if (!await _permissions.ExistsActiveByIdAsync(command.PermissionId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreatePolicyResponse>(
                new Error("policy.permission.not_found", "El permiso no existe o no está activo.", ErrorType.NotFound));
        }

        var id = _idGenerator.NewId();
        var created = Policy.Create(id, command.PermissionId, command.Effect, command.Condition);
        if (created.IsFailure)
        {
            return Result.Failure<CreatePolicyResponse>(created.Error!);
        }

        var policy = created.Value!;
        if (policy.Condition is { Length: > 0 } expression)
        {
            var syntax = await _policyEvaluator.ValidateConditionSyntaxAsync(expression, ct).ConfigureAwait(false);
            if (syntax.IsFailure)
            {
                return Result.Failure<CreatePolicyResponse>(syntax.Error!);
            }
        }

        await _policies.AddAsync(policy, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreatePolicyResponse(policy.Id, policy.PermissionId));
    }
}
