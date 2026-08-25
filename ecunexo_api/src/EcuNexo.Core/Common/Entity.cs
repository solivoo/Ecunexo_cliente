using System.Diagnostics.CodeAnalysis;


namespace EcuNexo.Core.Common;

public abstract class Entity<TId> :  IEquatable<Entity<TId>> where TId : notnull
{
    public TId Id { get; protected init; } = default!;

    // Suprime la advertencia CA1036, ya que se implementará comparación personalizada para entidades derivadas de Entity<TId>
    [SuppressMessage("Design", "CA1036", Justification = "Se implementa IEquatable<Entity<TId>> para comparar entidades por su identificador")]
    public override bool Equals(object? obj) => obj is Entity<TId> other && Equals(other);

    public bool Equals(Entity<TId>? other)
    {
        if(other is null || other.GetType() != GetType())
        { 
            return false;
        }

        return EqualityComparer<TId>.Default.Equals(Id, other.Id);
    }

    public override int GetHashCode() => HashCode.Combine(GetType(), Id);
    public static bool operator ==(Entity<TId>? left, Entity<TId>? right) => Equals(left, right);
    public static bool operator !=(Entity<TId>? left, Entity<TId>? right) => !Equals(left, right);

}