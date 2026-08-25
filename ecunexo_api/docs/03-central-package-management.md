# 03 — `Directory.Packages.props` (Central Package Management)

## Qué hicimos

Creamos `Directory.Packages.props` en la raíz del repo. Ahí declaramos **todas las versiones** de paquetes NuGet que usará cualquier proyecto:

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
    <CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>
  </PropertyGroup>

  <ItemGroup Label="EF Core / PostgreSQL">
    <PackageVersion Include="Microsoft.EntityFrameworkCore"          Version="10.0.7" />
    <PackageVersion Include="Npgsql.EntityFrameworkCore.PostgreSQL"  Version="10.0.1" />
    <!-- Npgsql 10.0.1 exige EF Relational >= 10.0.4; las versiones exactas viven en Directory.Packages.props -->
  </ItemGroup>
</Project>
```

## Por qué

### El problema que resuelve

Sin Central Package Management, **cada `.csproj` declara su propia versión** de cada paquete:

```xml
<!-- EcuNexo.Core.csproj -->
<PackageReference Include="FluentValidation" Version="11.5.0" />

<!-- EcuNexo.Business.csproj -->
<PackageReference Include="FluentValidation" Version="11.8.0" />

<!-- EcuNexo.Data.csproj -->
<PackageReference Include="FluentValidation" Version="12.0.0" />
```

Resultados típicos:
- Errores de runtime por incompatibilidad de versiones.
- "Diamond problem": dos paquetes piden versiones distintas del mismo dep.
- Cuando actualizas, tienes que tocar cada `.csproj`.

### Cómo lo resuelve

Con `ManagePackageVersionsCentrally=true`:

```xml
<!-- Directory.Packages.props -->
<PackageVersion Include="FluentValidation" Version="12.0.0" />

<!-- Cualquier .csproj -->
<PackageReference Include="FluentValidation" />   <!-- ← sin Version -->
```

**La versión vive en un solo lugar.** Cambias en un sitio, todos los proyectos se actualizan.

### `CentralPackageTransitivePinningEnabled=true`

Los paquetes que instalas tienen **dependencias transitivas** (lo que ellos a su vez requieren). Por defecto, NuGet resuelve la versión más alta compatible. Con esto activado, **fijamos también** las versiones transitivas a las que declaramos en `Directory.Packages.props`. Más determinismo, builds reproducibles.

## Qué declaramos

| Grupo | Paquetes | Para qué |
|---|---|---|
| EF Core / PostgreSQL | `Microsoft.EntityFrameworkCore.*`, `Npgsql.EntityFrameworkCore.PostgreSQL`, `EFCore.NamingConventions` | ORM y driver de PG. `NamingConventions` mapea PascalCase ↔ snake_case automáticamente. |
| Validation / DI | `FluentValidation`, `Scrutor` | Validación expresiva + escaneo de DI por convención. |
| API / Versioning / OpenAPI | `Asp.Versioning.*`, `Microsoft.AspNetCore.OpenApi` | Versionado de API y generación OpenAPI/Swagger. |
| Testing | `xunit`, `FluentAssertions`, `NSubstitute`, `Testcontainers.PostgreSql` | Stack de pruebas — incluye Postgres real (no in-memory). |

> 💡 No estamos instalando todavía estos paquetes. Solo **declaramos versiones disponibles**. La instalación se hace cuando un `.csproj` añada un `<PackageReference Include="X" />`.

## Conceptos aplicados

| Concepto | Para qué |
|---|---|
| **Central Package Management (CPM)** | Versiones unificadas. |
| **Pinning transitivo** | Builds determinísticos. |
| **NuGet** | Gestor de paquetes de .NET. |

## Qué estudiar

- [Central Package Management — docs oficiales](https://learn.microsoft.com/nuget/consume-packages/central-package-management).
- **NuGet 101**: cómo NuGet resuelve versiones (algoritmo "lowest applicable version" + ranges).
- **Versionado semántico (semver)**: `MAJOR.MINOR.PATCH` y qué significa romper cada uno.

## Trampas comunes

- ⚠️ Si un `.csproj` declara `<PackageReference Include="X" Version="..." />` con CPM activo, MSBuild lanza error: `NU1008`. Borra el `Version=` del `.csproj`.
- ⚠️ `Testcontainers.PostgreSql` requiere **Docker corriendo** para que las pruebas de integración funcionen. No es bloqueante hasta que lleguemos a tests.
- ⚠️ Las versiones que pusimos asumen .NET 10 GA. Si NuGet no encuentra `10.0.0` exacta, prueba con la más cercana (`10.0.0-rc.x`). Lo veremos cuando hagamos el primer `dotnet restore` que use estos paquetes.

## Verificación

Por ahora solo:

```powershell
dotnet build
```

No usa los paquetes aún (no los hemos referenciado en ningún `.csproj`), pero debe compilar sin tocar el archivo. Cuando agreguemos el primer `<PackageReference>`, restoreará y validará versiones.
