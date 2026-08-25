namespace EcuNexo.Core.Common;

// Sobrecarga de Tipos (o Type Overloading).

// En C#, tenemos dos "cajones" principales donde guardar datos: el Stack (la mesa de trabajo rápida) y el Heap (el depósito grande).
public readonly record struct Result
{
    // propiedades de instancia, se almacenan en el objeto
    public Error? Error { get; init; }

    // propiedades calculadas, no se almacenan en el objeto, se calculan en tiempo de ejecución
    public bool IsSuccess => Error is null;
    public bool IsFailure => !IsSuccess;

    // métodos de instancia, se pueden llamar en el objeto
    public static Result Success() => new();
    public static Result Failure(Error error) => new() { Error = error };

    // métodos de tipo, se pueden llamar en el tipo
    public static Result<T> Success<T>(T value) => new() { Value = value };
    public static Result<T> Failure<T>(Error error) => new() { Error = error };

    // métodos de tipo, se pueden llamar en el tipo
    public static implicit operator Result(Error error) => Failure(error);
}

public readonly record struct Result<T>
{
    public T? Value { get; init; }
    public Error? Error { get; init; }
    public bool IsSuccess => Error is null;
    public bool IsFailure => !IsSuccess;

    public static implicit operator Result<T>(T value) => new() { Value = value };
    public static implicit operator Result<T>(Error error) => new() { Error = error };
}
