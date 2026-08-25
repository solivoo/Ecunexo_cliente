using EcuNexo.Core.Common;

namespace EcuNexo.Business.Abstractions;

/// <summary>
/// Despachador ligero de comandos CQRS (sin MediatR): resuelve el handler registrado para el par comando/respuesta en el scope actual.
/// </summary>
public interface ISender
{
    Task<Result<TResponse>> SendAsync<TCommand, TResponse>(TCommand command, CancellationToken ct)
        where TCommand : ICommand<TResponse>;

    Task<Result<TResponse>> AskAsync<TQuery, TResponse>(TQuery query, CancellationToken ct)
        where TQuery : IQuery<TResponse>;
}
