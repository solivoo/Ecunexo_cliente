---
name: rbac-permisos-seeding
description: >-
  Estándares obligatorios de formato para códigos de permisos RBAC, reglas de seeders de base de datos
  (MenuCatalogSeedData) y prevención/diagnóstico de caídas en el arranque de la API (Cloudflare 502 / Connection refused).
---

# RBAC, Permisos y Seeders en EcuNexo

Este skill documenta los estándares estrictos para la creación de permisos RBAC, catálogo de navegación y diagnóstico de errores en el ciclo de vida de arranque del backend.

---

## 1. Regla de Oro: Formato de Códigos de Permiso

En EcuNexo, la entidad de dominio [`Permission.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Core/Identity/Permission.cs#L88-L105) aplica una validación algorítmica estricta sobre el código:

```csharp
ReadOnlySpan<char> span = normalized.AsSpan();
for (var i = 0; i < span.Length; i++)
{
    var c = span[i];
    if (c is >= 'a' and <= 'z' or '.') continue;
    if (c is >= '0' and <= '9') continue;

    return Result.Failure<Permission>(
        new Error(
            "permission.code.format",
            "El código solo puede usar minúsculas, dígitos y puntos como separador (p. ej. catalog.product.read).",
            ErrorType.Validation));
}
```

### Tabla de Validación de Formato:

| Formato | Estado | Motivo |
| :--- | :--- | :--- |
| `purchases.expenses.read` |  **VÁLIDO** | Minúsculas, puntos como único separador. |
| `catalog.item.create` |  **VÁLIDO** | Minúsculas y puntos. |
| `repairs.batches.read` |  **VÁLIDO** | Minúsculas y puntos. |
| `purchases.expense_types.read` | ❌ **PROHIBIDO** | Contiene guion bajo (`_`). Lanza `permission.code.format`. |
| `purchases.expense-types.read` | ❌ **PROHIBIDO** | Contiene guion medio (`-`). Lanza `permission.code.format`. |
| `purchases.Expenses.Read` | ❌ **PROHIBIDO** | Contiene mayúsculas (debe normalizarse a minúsculas). |
| `purchases..expenses.read` | ❌ **PROHIBIDO** | Contiene puntos dobles. |

> [!CAUTION]
> **NUNCA USES GUIONES BAJOS (`_`) EN UN CÓDIGO DE PERMISO.**
> Si un permiso contiene un guion bajo en [`MenuCatalogSeedData.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Development/MenuCatalogSeedData.cs), el seeder lanzará una `InvalidOperationException` no controlada en `Program.cs` (línea 164), lo que **matará el proceso de la API en el arranque** antes de que Kestrel abra el puerto `8080`, provocando un error **502 Bad Gateway** en Nginx y Cloudflare.

---

## 2. Catálogo de Permisos y Menú (`MenuCatalogSeedData.cs`)

Al agregar un nuevo módulo o funcionalidad:

1. **Definir el permiso:**
   Agregarlo en `MenuCatalogSeedData.Permissions` con:
   - Código canónico: `<modulo>.<recurso>.<accion>` (solo `[a-z0-9.]`).
   - Nombre para mostrar descriptivo (`DisplayName`).
   - Explicación de la acción autorizada (`Description`).
   - Módulo propietario (`Module`).
   - Número de orden relativo (`Sort`).

2. **Vincular en el menú de navegación (`MenuItems`):**
   - En la lista `RequiredPermissions` del `Item(...)`, colocar el mismo código exacto.
   - Si el menú es un contenedor padre (ej: `compras`), dejar `RequiredPermissions: []` para que sea visible si el usuario tiene permiso a cualquiera de los submenús hijos.

3. **Verificación local obligatoria:**
   Ejecutar siempre las pruebas antes de confirmar el commit:
   ```bash
   dotnet test ecunexo_api/tests/EcuNexo.Core.UnitTests/
   dotnet test ecunexo_api/tests/EcuNexo.Business.UnitTests/
   ```

---

## 3. Matriz de Diagnóstico: Errores Cloudflare 520 / Nginx 502

Cuando en el navegador o en curl aparezca un error HTTP 520 o 502:

| Síntoma | Dónde mirar | Causa Raíz Frecuente |
| :--- | :--- | :--- |
| **HTTP 520 Cloudflare** | Servidor host (IP / ping / SSH) | • Máquina virtual apagada o reiniciada en OCI.<br>• IP pública cambió tras reinicio (IP efímera vs reservada).<br>• Firewall o Security List bloqueando el tráfico. |
| **HTTP 502 Cloudflare / Nginx** | Logs de `ecunexo-cliente-spa-1` | • Si dice `111: Connection refused` a `http://172.x.x.x:8080`, el contenedor SPA está sano pero el contenedor de la API está caído o reiniciando. |
| **Connection Refused en :8080** | Logs de `ecunexo-cliente-api-1` | • **Excepción de formato de permisos:** `permission.code.format` en `MenuCatalogSeeder`.<br>• **Volumen obligatorio faltante:** Error de sintaxis `:?set` en `docker-compose.yml`.<br>• **Fallo de base de datos:** Postgres no disponible o migración fallida en `MigrateAsync`. |
