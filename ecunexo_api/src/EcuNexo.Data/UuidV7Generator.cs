using EcuNexo.Core.Abstractions;

namespace EcuNexo.Data;

internal sealed class UuidV7Generator : IIdGenerator
{
    public Guid NewId() => Guid.CreateVersion7();
}
