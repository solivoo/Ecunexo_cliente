# 02 — `Directory.Build.props`

## Qué hicimos

Creamos en la raíz del repo un archivo `Directory.Build.props`:

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>$(NoWarn);CS1591</NoWarn>
  </PropertyGroup>
</Project>
```

Y borramos esas mismas propiedades de cada `.csproj` (ya no son necesarias).

## Por qué

`Directory.Build.props` es **un archivo mágico de MSBuild**: cualquier `.csproj` debajo de la jerarquía de carpetas lo hereda automáticamente, **sin necesidad de importarlo**.

Beneficios:
- **Una sola fuente de verdad** para configuración común.
- Cambias .NET 10 → 11 en un solo lugar y todos los proyectos quedan actualizados.
- Los `.csproj` quedan minimalistas (solo declaran lo específico de ese proyecto).

> 💡 Si un `.csproj` redefine una propiedad, gana el `.csproj`. Si no la redefine, hereda del `Directory.Build.props` más cercano hacia arriba en el árbol.

## Qué hace cada propiedad

### `<TargetFramework>net10.0</TargetFramework>`

El **TFM (Target Framework Moniker)**. Le dice al compilador para qué versión de .NET compilar. `net10.0` = .NET 10.

### `<LangVersion>latest</LangVersion>`

Versión de C#. `latest` = la más nueva disponible para el SDK instalado. Habilita features de C# 14 (primary constructors en records, collection expressions, etc.).

### `<Nullable>enable</Nullable>`

**Nullable Reference Types**. El compilador trata todas las referencias como **NO nulleables por defecto**. Si quieres permitir null, debes declararlo con `?`:

```csharp
string nombre = null;          // ❌ ERROR
string? nombre = null;         // ✅ OK
```

> 💡 Esta es la feature más importante de C# moderno. Elimina la categoría "NullReferenceException" de tus bugs.

### `<ImplicitUsings>enable</ImplicitUsings>`

Genera `global using` para namespaces comunes (`System`, `System.Collections.Generic`, etc.). Ya no tienes que escribir `using System;` arriba de cada archivo.

### `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`

**Cualquier warning es tratado como error**. Si compila, está limpio. Si tiene warnings, no compila. Disciplina dura pero correcta.

> ⚠️ Esto es lo que hizo que tu compilación fallara en el paso 7: las reglas CA1716 y CA1000 son *warnings*, pero con esta opción se vuelven errores.

### `<AnalysisLevel>latest-recommended</AnalysisLevel>`

Activa los **Roslyn Analyzers** (analizadores de código) en el nivel "recomendado" más reciente. Detectan problemas de calidad, performance, seguridad antes de compilar.

### `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>`

Las reglas de estilo declaradas en `.editorconfig` se aplican **en compilación**, no solo en el editor. Si violas el estilo → no compila.

### `<GenerateDocumentationFile>true</GenerateDocumentationFile>`

Genera el archivo XML de documentación (lo que sale de los comentarios `///`). Útil para:
- Que IntelliSense muestre tu doc.
- Que el motor de OpenAPI/Swagger documente automáticamente la API.

### `<NoWarn>$(NoWarn);CS1591</NoWarn>`

Lista de códigos de warning que **se ignoran**. Aquí silenciamos `CS1591` (que pide doc XML en cada miembro público) porque sería ruido en partes internas del proyecto.

> 💡 Sintaxis MSBuild: `$(NoWarn)` es la variable previa; le concatenamos `;CS1591`. Así no pisamos otros NoWarn que vengan de plantillas.

## Conceptos aplicados

| Concepto | Para qué |
|---|---|
| **MSBuild Property Inheritance** | Configuración DRY entre proyectos. |
| **Roslyn Analyzers** | Reglas de calidad automáticas. |
| **Nullable Reference Types** | Eliminar `NullReferenceException`. |
| **Treat Warnings as Errors** | Disciplina de calidad. |

## Qué estudiar

- **MSBuild docs** sobre `Directory.Build.props`: [Microsoft Learn](https://learn.microsoft.com/visualstudio/msbuild/customize-by-directory).
- **Nullable Reference Types**: [guía oficial](https://learn.microsoft.com/dotnet/csharp/nullable-references).
- **Roslyn Analyzers**: lista completa de reglas CA en [learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules).

## Trampas comunes

- ⚠️ El nombre del archivo es **case-sensitive en Linux/macOS**. La convención es `Directory.Build.props` (B mayúscula). En Windows funciona con cualquier capitalización pero **renómbralo a `Directory.Build.props`** si vas a versionarlo en Git.
- ⚠️ Si pones `Directory.Build.props` en una carpeta intermedia (ej. `src/`), **solo afecta a los proyectos debajo de esa carpeta**. La regla "el más cercano gana" aplica.
- ⚠️ También existe `Directory.Build.targets` (se ejecuta DESPUÉS) y `Directory.Solution.props` (a nivel de la solución). Saberlo evita confusiones.
