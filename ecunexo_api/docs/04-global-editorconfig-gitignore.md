# 04 — `global.json`, `.editorconfig`, `.gitignore`

Tres archivos pequeños pero importantes en la raíz del repo. Cada uno resuelve un problema distinto.

---

## A) `global.json` — fijar la versión del SDK

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature",
    "allowPrerelease": false
  }
}
```

### Para qué

Tu máquina puede tener varios SDKs instalados (8.0, 9.0, 10.0). `global.json` le dice al CLI **cuál usar** dentro de este repo.

| Campo | Significado |
|---|---|
| `version` | Versión mínima requerida del SDK. |
| `rollForward: latestFeature` | Permite usar `10.0.x` aunque la mínima sea `10.0.100`. |
| `allowPrerelease: false` | No usar SDKs preview. |

> 💡 Sin `global.json`, si mañana instalas el SDK 11.0, podrías compilar diferente que tu compañero. Esto **garantiza reproducibilidad**: cualquier dev que clone el repo construirá igual.

### Verificación

```powershell
dotnet --version
```

Debe imprimir una versión `10.0.x`. Si no, instala el SDK 10 desde [dotnet.microsoft.com](https://dotnet.microsoft.com/download).

---

## B) `.editorconfig` — estilo de código uniforme

Archivo declarativo de **convenciones de formato y reglas de análisis**, leído por:
- Visual Studio, Rider, VS Code (formatean al guardar).
- El compilador (cuando `EnforceCodeStyleInBuild=true` está activo).

### Bloques importantes

```ini
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
```

Aplica a **todos** los archivos: UTF-8, fin de línea LF (Unix), siempre nueva línea final, indentación con espacios.

```ini
[*.{cs,csx}]
indent_size = 4
```

Para C#: 4 espacios por nivel.

```ini
[*.{json,yml,yaml,xml,csproj,props,targets}]
indent_size = 2
```

Para configuración: 2 espacios.

### Reglas de C# específicas

```ini
csharp_style_namespace_declarations = file_scoped:error
```

Obliga **file-scoped namespaces**:

```csharp
// ✅ Correcto (file-scoped)
namespace EcuNexo.Core.Common;

public sealed class Money { }

// ❌ Antiguo (block-scoped) — el compilador da error
namespace EcuNexo.Core.Common
{
    public sealed class Money { }
}
```

Beneficio: menos indentación, más legible.

```ini
csharp_style_var_when_type_is_apparent = true:suggestion
csharp_style_var_elsewhere = false:suggestion
```

`var` solo cuando el tipo es obvio del lado derecho:

```csharp
var product = new Product(...);                // ✅ tipo obvio
var products = await repo.GetAllAsync();       // ❌ tipo no obvio → escribe IReadOnlyList<Product>
```

### Naming rules

```ini
dotnet_naming_rule.private_fields_underscore.severity = error
dotnet_naming_rule.private_fields_underscore.symbols = private_fields
dotnet_naming_rule.private_fields_underscore.style   = underscore_camel_case

dotnet_naming_symbols.private_fields.applicable_kinds = field
dotnet_naming_symbols.private_fields.applicable_accessibilities = private

dotnet_naming_style.underscore_camel_case.required_prefix = _
dotnet_naming_style.underscore_camel_case.capitalization  = camel_case
```

Esto fuerza que **todo campo privado lleve `_camelCase`**:

```csharp
private readonly IProductRepository _repository;   // ✅
private readonly IProductRepository repository;    // ❌ ERROR de compilación
```

### Supresión de reglas específicas

```ini
dotnet_diagnostic.IDE0005.severity = warning   # unused usings
dotnet_diagnostic.CA2007.severity  = none      # ConfigureAwait — no aplica en ASP.NET Core
dotnet_diagnostic.CA1716.severity  = none      # nombre choca con palabra reservada (VB.NET/F#)
dotnet_diagnostic.CA1014.severity  = none      # CLSCompliantAttribute
```

> 💡 Cada vez que silenciemos una regla, dejamos un comentario corto explicando **por qué**. Es buen hábito para auditoría futura.

---

## C) `.gitignore` — qué NO versionar

Generado por:

```powershell
dotnet new gitignore
```

Incluye automáticamente: `bin/`, `obj/`, `*.user`, archivos de Visual Studio, Rider, VS Code, etc.

### Lo que añadimos al final

```gitignore
# EcuNexo
*.received.*                    # archivos temporales de approval testing
.idea/                          # cache JetBrains
.vs/                            # cache Visual Studio
.env*                           # variables de entorno locales
appsettings.*.local.json        # configs locales por developer
```

### Por qué

> ⚠️ **Nunca** comitees `bin/` ni `obj/` (artefactos generados), `.env` con secretos, ni `appsettings.Local.json`. Son fuentes garantizadas de bugs y/o filtraciones.

### Verificación

```powershell
git status
```

No debería listar nada bajo `bin/` u `obj/`. Si sí, revisa que el `.gitignore` esté en la raíz y no haya un cache previo (`git rm -r --cached .` lo limpia).

---

## Conceptos aplicados

| Concepto | Para qué |
|---|---|
| **SDK pinning** | Reproducibilidad. |
| **EditorConfig** | Estándar abierto multi-IDE para estilo. |
| **Code Style as Build** | Estilo es contrato, no preferencia. |
| **Naming Conventions** | Disciplina automatizada. |

## Qué estudiar

- [`global.json` — docs](https://learn.microsoft.com/dotnet/core/tools/global-json).
- [EditorConfig.org](https://editorconfig.org/) — sintaxis general.
- [.NET code-style rules en EditorConfig](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/code-style-rule-options).
- [Reglas CA (Code Analysis) completas](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules).
