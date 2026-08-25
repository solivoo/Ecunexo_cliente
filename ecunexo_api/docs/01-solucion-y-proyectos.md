# 01 — Solución y proyectos

## Qué hicimos

```powershell
dotnet new sln -n EcuNexo
dotnet new classlib -n EcuNexo.Core     -o src/EcuNexo.Core     -f net10.0
dotnet new classlib -n EcuNexo.Business -o src/EcuNexo.Business -f net10.0
dotnet new classlib -n EcuNexo.Data     -o src/EcuNexo.Data     -f net10.0
dotnet new web      -n EcuNexo.Api      -o src/EcuNexo.Api      -f net10.0

dotnet sln add (Get-ChildItem -Recurse -Filter *.csproj).FullName

# Referencias entre proyectos
dotnet add src/EcuNexo.Business reference src/EcuNexo.Core
dotnet add src/EcuNexo.Data     reference src/EcuNexo.Core
dotnet add src/EcuNexo.Data     reference src/EcuNexo.Business
dotnet add src/EcuNexo.Api      reference src/EcuNexo.Business
dotnet add src/EcuNexo.Api      reference src/EcuNexo.Data
```

Resultado:

```
EcuNexo.slnx
└── src/
    ├── EcuNexo.Core/EcuNexo.Core.csproj          (classlib)
    ├── EcuNexo.Business/EcuNexo.Business.csproj  (classlib)
    ├── EcuNexo.Data/EcuNexo.Data.csproj          (classlib)
    └── EcuNexo.Api/EcuNexo.Api.csproj            (web)
```

## Por qué

### Solución (`.slnx`)

Una **solución** agrupa proyectos relacionados y los abre como una unidad en el IDE.

- Visual Studio / Rider / VS Code la usan para construir todos los proyectos juntos en orden correcto.
- `.slnx` es el formato **moderno XML** que reemplaza al viejo `.sln` (formato propietario, ilegible). .NET 10 soporta ambos. Nosotros usamos `.slnx`.

> 💡 Si abres `EcuNexo.slnx` con un editor de texto, verás XML simple. El viejo `.sln` está lleno de GUIDs ininteligibles.

### Por qué 4 proyectos y no uno solo

Esto es **Clean Architecture**. Separamos en proyectos para que el compilador **fuerce** las reglas de dependencia. Si `EcuNexo.Core` no tiene referencia a `EcuNexo.Data`, **nadie puede** importar EF Core dentro del dominio aunque lo intente. La arquitectura se vuelve física, no solo "buena intención".

| Proyecto | Plantilla `dotnet new` | Por qué esa plantilla |
|---|---|---|
| `EcuNexo.Core` | `classlib` | Solo código, sin web. No corre solo. |
| `EcuNexo.Business` | `classlib` | Idem. |
| `EcuNexo.Data` | `classlib` | Idem. |
| `EcuNexo.Api` | `web` | Es el único que se ejecuta como host HTTP. |

### Dirección de las referencias

```
Api ──► Business ──► Core
 │                     ▲
 └─────► Data ─────────┘
```

Reglas que esto enforza:

- ✅ `Business` puede usar tipos de `Core`.
- ✅ `Data` puede usar tipos de `Core` y `Business`.
- ✅ `Api` puede usar tipos de `Business` y `Data`.
- 🚫 `Core` **no puede** usar nada de los otros tres. Si lo intentas, **no compila**.
- 🚫 `Business` **no puede** usar `Data`. La aplicación define interfaces (ej. `IProductRepository`) y la infraestructura las implementa. Patrón **Dependency Inversion**.

> ⚠️ Este último punto es la **regla más importante** de Clean Architecture y la más violada por equipos sin experiencia: nunca dejes que la capa de aplicación dependa de EF Core, archivos, HTTP, etc. Esos son detalles que viven en `Data` o `Api`.

### Por qué `Data` referencia a `Business`

Porque `Business` declara abstracciones como `ITenantContext`, `IUnitOfWork`, `ICurrentUser`, y `Data` las implementa. Sin esa referencia, `Data` no puede implementarlas.

## Conceptos aplicados

| Concepto | Dónde lo ves |
|---|---|
| **Clean Architecture** | La separación de los 4 proyectos. |
| **Dependency Inversion Principle** (la "D" de SOLID) | `Business` define interfaces; `Data` las implementa. |
| **Composition Root** | `EcuNexo.Api` es el único lugar donde se "arma" la app (registra DI). |
| **Multi-target framework** (TFM) | El `-f net10.0` fija el target framework moniker. |

## Qué estudiar

- **Clean Architecture** — Robert C. Martin, libro homónimo. Capítulos 17–22.
- **The Dependency Inversion Principle** — el famoso paper de Uncle Bob.
- **`dotnet` CLI**: [docs oficiales](https://learn.microsoft.com/dotnet/core/tools/).
- **Diferencia `.sln` vs `.slnx`**: [blog de .NET](https://devblogs.microsoft.com/dotnet/) (busca "slnx").

## Verificación

```powershell
dotnet build
```

Debe imprimir `Compilación correcta` sin errores. Si lo hace, las dependencias están bien armadas.
