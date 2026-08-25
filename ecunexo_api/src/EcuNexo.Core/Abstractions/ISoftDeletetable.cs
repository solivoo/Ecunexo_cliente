namespace EcuNexo.Core.Abstractions;

public interface ISoftDeletable
{
    DateTimeOffset? DeletedAt { get; }
    Guid? DeletedBy { get; }
    bool IsDeleted => DeletedAt is not null;
}
