using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using Microsoft.Extensions.DependencyInjection;

namespace EcuNexo.Business;

public sealed class Sender(IServiceProvider services) : ISender
{
    public Task<Result<TResponse>> SendAsync<TCommand, TResponse>(TCommand command, CancellationToken ct)
        where TCommand : ICommand<TResponse>
    {
        var handler = services.GetRequiredService<ICommandHandler<TCommand, TResponse>>();
        return handler.Handle(command, ct);
    }

    public Task<Result<TResponse>> AskAsync<TQuery, TResponse>(TQuery query, CancellationToken ct)
        where TQuery : IQuery<TResponse>
    {
        var handler = services.GetRequiredService<IQueryHandler<TQuery, TResponse>>();
        return handler.Handle(query, ct);
    }
}
