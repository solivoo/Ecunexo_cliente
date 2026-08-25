# 06 — `Result<T>` y `Error` (Result Pattern)

## Qué hicimos

Creamos dos archivos en `src/EcuNexo.Core/Common/`:

- `Error.cs` — describe un error de negocio.
- `Result.cs` — encapsula el resultado de una operación: éxito (con valor opcional) o fallo (con `Error`).

```csharp
// Error.cs
namespace EcuNexo.Core.Common;

public sealed record Error(string Code, string Message, ErrorType Type)
{
    public static readonly Error None = new(string.Empty, string.Empty, ErrorType.Unexpected);
}

public enum ErrorType
{
    Validation,
    NotFound,
    Conflict,
    Unauthorized,
    Forbidden,
    Unexpected
}
```

```csharp
// Result.cs
namespace EcuNexo.Core.Common;

public readonly record struct Result
{
    public Error? Error { get; init; }
    public bool IsSuccess => Error is null;
    public bool IsFailure => !IsSuccess;

    public static Result Success() => new();
    public static Result Failure(Error error) => new() { Error = error };

    public static Result<T> Success<T>(T value) => new() { Value = value };
    public static Result<T> Failure<T>(Error error) => new() { Error = error };

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
```

## Por qué — el problema de las excepciones

El estilo "tradicional" usa excepciones para todo:

```csharp
public Product CreateProduct(string name, string sku)
{
    if (await _repo.ExistsBySkuAsync(sku))
        throw new SkuAlreadyExistsException(sku);

    return new Product(name, sku);
}
```

Problemas:

1. **Las excepciones son caras.** Lanzar una excepción ejecuta stack unwind, captura stack trace, recorrido de catch handlers... fácilmente 1000× más lento que un `return`.
2. **No están en la firma del método.** Llamas `CreateProduct(...)` y no sabes si puede fallar — tienes que leer el código fuente.
3. **Mezclan dos cosas distintas**: errores de programación (bug, null inesperado, división por cero) y reglas de negocio (SKU duplicado, stock insuficiente). Las excepciones son apropiadas para lo primero, pésimas para lo segundo.

## El Result Pattern

> **Regla**: las excepciones son para **lo inesperado**. Los `Result<T>` son para el **flujo de negocio normal**, incluyendo sus errores predecibles.

```csharp
public async Task<Result<ProductId>> Handle(CreateProductCommand cmd, CancellationToken ct)
{
    if (await _repo.ExistsBySkuAsync(cmd.Sku, ct))
        return new Error(
            "catalog.product.sku_exists",
            $"Ya existe un producto con SKU {cmd.Sku}.",
            ErrorType.Conflict);   // ← conversión implícita Error → Result<ProductId>

    var product = Product.Create(cmd.Name, cmd.Sku);
    await _repo.AddAsync(product, ct);
    return product.Id;             // ← conversión implícita ProductId → Result<ProductId>
}
```

Beneficios:

1. **La firma dice la verdad.** Si retorna `Result<T>`, el llamador sabe que puede fallar.
2. **Cero excepciones en el happy path.** Performance estable y predecible.
3. **Errores tipados** (`ErrorType`) → el endpoint los traduce a HTTP correctos (404, 409, 422...).

## Anatomía pieza por pieza

### `Error` como `record`

```csharp
public sealed record Error(string Code, string Message, ErrorType Type);
```

`record` te da gratis: igualdad por valor, `Equals`, `GetHashCode`, `ToString`, `with`. Inmutable por diseño.

| Campo | Para qué |
|---|---|
| `Code` | Identificador estable y máquina-friendly (`catalog.product.sku_exists`). Útil en logs, i18n, tests. |
| `Message` | Mensaje en español listo para mostrar al usuario. |
| `Type` | Categoriza el error → mapea a HTTP. |

### `ErrorType` como `enum`

| Valor | Mapeo HTTP típico |
|---|---|
| `Validation` | 422 Unprocessable Entity |
| `NotFound` | 404 Not Found |
| `Conflict` | 409 Conflict |
| `Unauthorized` | 401 Unauthorized |
| `Forbidden` | 403 Forbidden |
| `Unexpected` | 500 Internal Server Error |

### `Result` y `Result<T>`

Dos tipos:
- `Result` — para acciones que **no devuelven valor** (ej. `DeleteProduct`).
- `Result<T>` — para queries/commands que sí devuelven valor (ej. `GetProductById` → `Result<Product>`).

### ¿Por qué `readonly record struct` y no `class`?

| Característica | `record class` | `readonly record struct` |
|---|---|---|
| Asignación | en heap | en stack (sin GC) |
| Igualdad por valor | sí | sí |
| Costo de allocation | sí | no |
| Posible boxing | no | sí (raro) |

Como `Result<T>` se devuelve **muchísimas veces** en el flujo normal, ahorrar la allocation tiene impacto real. `readonly record struct` da igualdad por valor + zero allocation.

### `init` properties

```csharp
public T? Value { get; init; }
```

`init` permite asignación **solo durante construcción** (object initializer `new() { Value = x }`). Después, **inmutable**. Lo mejor de `readonly` y de los object initializers a la vez.

### Operadores implícitos — el azúcar clave

```csharp
public static implicit operator Result<T>(T value) => new() { Value = value };
public static implicit operator Result<T>(Error error) => new() { Error = error };
```

Esto te permite escribir:

```csharp
return product.Id;        // T → Result<T>
return new Error(...);    // Error → Result<T>
```

…sin escribir `Result.Success(...)` ni `Result.Failure(...)`. Más limpio en cada handler.

## Por qué el rediseño del archivo (resolviendo CA1000)

La versión inicial tenía los factory methods dentro del genérico:

```csharp
public readonly record struct Result<T>
{
    public static Result<T> Success(T value) => ...;   // ⚠️ CA1000
    public static Result<T> Failure(Error error) => ...;
}
```

**CA1000 — "No declarar miembros estáticos en tipos genéricos"**: el llamador debe escribir `Result<int>.Success(42)` en lugar de inferir el tipo. Microsoft recomienda tener una clase no genérica como factory.

Solución: movimos `Success<T>(T value)` y `Failure<T>(Error error)` al `Result` no genérico, donde la regla no aplica:

```csharp
Result.Success(42);          // infiere Result<int> automáticamente
Result.Failure<int>(error);  // explícito si no hay forma de inferir
```

Y como bonus, los operadores implícitos hacen que en la mayoría de casos ni necesites llamar a estos factories:

```csharp
return 42;                   // implícito → Result<int>
return new Error(...);       // implícito → Result<int>
```

## Por qué suprimimos CA1716

**CA1716 — "El nombre choca con palabra reservada"**: `Error` es palabra reservada en VB.NET y F#. Si nuestro ensamblado fuera consumido desde VB.NET, los devs verían fricción.

**Decisión**: suprimir la regla. Razones:

1. **EcuNexo es C# puro**, nunca consumiremos VB.NET ni F#.
2. **`Error` es el nombre semánticamente correcto.** Renombrarlo a `DomainError` o `ResultError` sería ruido.
3. Microsoft mismo usa `Error` en su BCL (ej. `Microsoft.AspNetCore.Diagnostics.Error`).

La supresión vive en `.editorconfig` con comentario justificativo:

```ini
dotnet_diagnostic.CA1716.severity = none   # palabra reservada VB.NET/F#; EcuNexo es C# puro
```

> 💡 **Lección general**: las reglas CA son guías, no leyes. Cuando suprimas una, **deja un comentario con la razón**. Hace 1000% más fácil revisarlas en el futuro.

## Conceptos aplicados

| Concepto | Para qué |
|---|---|
| **Result Pattern / Railway-Oriented Programming** | Errores de negocio sin excepciones. |
| **`record` types** | Inmutabilidad + igualdad por valor. |
| **`readonly record struct`** | Cero allocation en el happy path. |
| **`init` properties** | Inmutabilidad post-construcción. |
| **Operadores implícitos** | Ergonomía en el call site. |
| **Roslyn analyzers (CA*)** | Calidad automatizada — y cómo manejarlos cuando una regla no aplica. |

## Qué estudiar

- **Vladimir Khorikov — "Functional C# in Practice"** (Pluralsight) — cubre Result, Maybe, etc.
- **Scott Wlaschin — "Railway-Oriented Programming"**: [fsharpforfunandprofit.com](https://fsharpforfunandprofit.com/posts/recipe-part2/). Ejemplos en F#, conceptos universales.
- **Reglas CA detalle**: cada error CA*XXX* tiene su propia página en learn.microsoft.com.

## Cómo lo usaremos en pasos siguientes

- Cada `ICommandHandler<T>` y `IQueryHandler<T>` devolverá `Task<Result<T>>`.
- En el endpoint Minimal API, traduciremos `Result<T>` → `IResult` (HTTP) con un método de extensión `ToHttpResult()`.
- El `Error.Code` lo usaremos como clave en logs y para tests (`error.Code.Should().Be("catalog.product.sku_exists")`).

## Verificación

```powershell
dotnet build
```

Debe compilar sin warnings (`TreatWarningsAsErrors=true` rechazaría cualquiera). Si pasa, el Result Pattern está listo para usarse en toda la capa Business.
