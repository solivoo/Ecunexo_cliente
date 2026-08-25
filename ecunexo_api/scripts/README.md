# Scripts de seed y códigos de activación

## 1. Seed automático (recomendado en Development)

1. Aplica migraciones (desde la raíz del repo):

   ```bash
   dotnet ef database update --project src/EcuNexo.Data --startup-project src/EcuNexo.Api
   ```

2. Configura **`ActivationCodes:Pepper`** en `src/EcuNexo.Api/appsettings.Development.json` (ya hay un ejemplo de desarrollo).

3. Arranca la Api en **Development** (libera el puerto 5088 si quedó ocupado por un `dotnet run` anterior):

   ```powershell
   .\dev.ps1
   ```

   Equivalente:

   ```powershell
   .\scripts\Start-DevApi.ps1
   ```

   Si solo quieres liberar el puerto sin arrancar:

   ```powershell
   .\scripts\Stop-DevApiPort.ps1
   ```

   > En Windows, si la API crashea al iniciar (p. ej. migración pendiente), el proceso puede quedar escuchando en `:5088`. Usa `Stop-DevApiPort.ps1` o `Start-DevApi.ps1` en lugar de `dotnet run` directo.

   Alternativa clásica (sin liberar puerto automáticamente):

   ```bash
   dotnet run --project src/EcuNexo.Api
   ```

Al iniciar, en este orden:

- **`DevelopmentActivationCodeSeeder`**: si la tabla `tenancy.activation_codes` está **vacía**, inserta un código cuyo texto en claro es **`DEV-ECUNEXO-ACTIVATION`** (la huella depende del pepper).
- **`DevelopmentCatalogSeeder`**: si **no hay ningún tenant**, crea el demo **Everchic Demo**, permisos, rol Administrador con todos los permisos activos y el usuario **`superusuario.seed@ecunexo.local`**.

Si la tabla `activation_codes` ya tiene filas, el seeder de códigos **no inserta** nada. Para repetir: borra filas en `tenancy.activation_codes` o usa el script de la sección 2 con otro código.

---

## 2. Generar huella + SQL manual (`Generar-Seed-CodigoActivacion.ps1`)

Útil para **producción** o cuando quieras un código distinto sin tocar C#.

Desde la raíz del repositorio (PowerShell):

```powershell
.\scripts\Generar-Seed-CodigoActivacion.ps1 `
  -Pepper 'TU_PEPPER_EXACTO_DE_APPSETTINGS' `
  -Codigo 'EL-CODIGO-QUE-ENTREGARAS-AL-CLIENTE' `
  -EmitirSql
```

- Imprime **`code_hash`** (hex mayúsculas, mismo criterio que `ActivationCodeHasher` en .NET).
- Con **`-EmitirSql`**, imprime un `INSERT` de ejemplo en `tenancy.activation_codes` (revisa UUID duplicados y la columna **`xmin`**: según versión de PostgreSQL/EF puede requerir ajuste; si falla, inserta vía aplicación o herramienta que use el mismo modelo que EF).

**Módulos** en el SQL de ejemplo: `identity`, `catalog`, `warehousing`, `inventory`, `invoicing` (lista fija del script; edita el JSON si tu plan es otro).

---

## 3. Relación con la documentación

- Flujo HTTP y tablas: **`docs/14-onboarding-y-codigos-activacion.md`**
- Intro producto: **`docs/00-introduccion.md`**
