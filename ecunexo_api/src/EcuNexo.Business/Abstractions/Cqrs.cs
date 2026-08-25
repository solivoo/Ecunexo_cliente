using EcuNexo.Core.Common;

namespace EcuNexo.Business.Abstractions;

/// <summary>
/// Marker for write operations (change system state).
/// </summary>
public interface ICommand<TResponse> { }

/// <summary>
/// Marker for read operations (no side effects in the domain sense).
/// </summary>
public interface IQuery<TResponse> { }

public interface ICommandHandler<in TCommand, TResponse>
    where TCommand : ICommand<TResponse>
{
    Task<Result<TResponse>> Handle(TCommand command, CancellationToken ct);
}

public interface IQueryHandler<in TQuery, TResponse>
    where TQuery : IQuery<TResponse>
{
    Task<Result<TResponse>> Handle(TQuery query, CancellationToken ct);
}
