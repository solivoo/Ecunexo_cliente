# 16 — API: versionamiento HTTP

Documento de referencia del **versionado de la API tenant** (`EcuNexo.Api`). Complementa el catálogo de rutas de **[`10-api-host-y-endpoints.md`](10-api-host-y-endpoints.md)**.

## Decisión

| Aspecto | Valor en EcuNexo |
|---|---|
| Estrategia | **Versionado en URL** (segmento de ruta) |
| Versión actual | **`1.0`** → rutas `/api/v1/...` |
| Librería | [`Asp.Versioning.Http`](https://github.com/dotnet/aspnet-api-versioning) + ApiExplorer |
| Lector | **solo** `UrlSegmentApiVersionReader` (no header ni query) |
| Contrato SPA | `ecunexo_admin` llama siempre **`/api/v1/...`** |

> 💡 Una sola convención visible para clientes: la versión va en la URL. Evita ambigüedad con headers (`api-version`) o query (`?api-version=`).

> ⚠️ No inventar otra forma de versionar en paralelo. Si el cliente manda `Accept: application/json` sin segmento `vN`, no hay “versión mágica” distinta: el default configurado es **1.0**, pero las rutas reales siguen el patrón `/api/v{version}/...`.

---

## 1. Configuración en el host (`Program.cs`)

```csharp
builder.Services.AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
        options.ApiVersionReader = new UrlSegmentApiVersionReader();
    })
    .AddApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";   // → "v1"
        options.SubstituteApiVersionInUrl = true;
    });
```

| Opción | Efecto |
|---|---|
| `DefaultApiVersion = 1.0` | Versión asumida cuando el framework necesita un default. |
| `AssumeDefaultVersionWhenUnspecified` | Si no hay versión en el request (rutas no versionadas / edge cases), usa 1.0. |
| `ReportApiVersions = true` | Respuestas incluyen cabeceras de versiones soportadas/deprecadas. |
| `UrlSegmentApiVersionReader` | Lee la versión del segmento `{version:apiVersion}` en la ruta. |
| `GroupNameFormat = "'v'VVV"` | Agrupa OpenAPI/Scalar como **`v1`**. |
| `SubstituteApiVersionInUrl` | Sustituye `{version}` en plantillas al generar el documento OpenAPI. |

Paquetes (CPM en `Directory.Packages.props`):

- `Asp.Versioning.Http`
- `Asp.Versioning.Mvc.ApiExplorer`

---

## 2. Anatomía de un grupo versionado

Patrón usado en todos los `Map*EndpointsV1`:

```csharp
ApiVersionSet versionSet = app.NewApiVersionSet()
    .HasApiVersion(new ApiVersion(1, 0))
    .ReportApiVersions()
    .Build();

RouteGroupBuilder group = app
    .MapGroup("/api/v{version:apiVersion}/auth")  // ← constraint apiVersion
    .WithApiVersionSet(versionSet)
    .WithTags("Auth");

group.MapPost("/login", LoginAsync);
```

URL efectiva: **`POST /api/v1/auth/login`**.

| Pieza | Rol |
|---|---|
| `NewApiVersionSet()` | Declara qué versiones aplica el grupo. |
| `HasApiVersion(1, 0)` | Este grupo pertenece a v1. |
| `v{version:apiVersion}` | Constraint: solo acepta valores de versión conocidos. |
| `WithTags(...)` | Agrupa en OpenAPI / Scalar. |
| `Map*EndpointsV1` | Extensión registrada en `Program.cs`. |

Registro en composition root (`Program.cs`):

```csharp
app.MapAuthEndpointsV1();
app.MapCatalogEndpointsV1();
// … resto de Map*EndpointsV1
```

---

## 3. Organización de carpetas (contrato = versión)

```
EcuNexo.Api/
├── Endpoints/
│   ├── V1/          ← implementación HTTP activa
│   │   ├── Auth/
│   │   ├── Catalog/
│   │   ├── Identity/
│   │   ├── Inventory/
│   │   ├── Platform/
│   │   ├── Subscription/
│   │   ├── Tenancy/
│   │   └── Warehousing/
│   └── V2/          ← reservado (vacío hasta que exista v2)
└── Contracts/
    └── V1/          ← DTOs request/response de la capa Api
        ├── Auth/
        ├── Catalog/
        └── …
```

| Capa | ¿Lleva `V1` en el path? | Motivo |
|---|---|---|
| `Endpoints/V1` | **Sí** | Contrato HTTP público versionado. |
| `Contracts/V1` | **Sí** | Shape JSON del wire; puede divergir entre v1 y v2. |
| `Business` / `Core` | **No** | Casos de uso y dominio no se versionan por URL. Un handler puede servir a v1 y v2 si el contrato no rompe. |

> 💡 Versionar la **API** no implica versionar el dominio. v2 solo nace cuando el **contrato HTTP** (rutas, campos, semántica) rompe clientes existentes.

---

## 4. Qué está versionado y qué no

| Ruta | ¿Versionada? | Notas |
|---|---|---|
| `/api/v1/...` | **Sí** | Todo el producto tenant. |
| `GET /` | No | Health mínimo `{ service, status }`. |
| `GET /openapi/v1.json` | Nombre `v1` = grupo OpenAPI | Documento generado; no es el mismo mecanismo que `apiVersion` de Asp.Versioning, pero alineado al grupo **v1**. |
| `GET /scalar/v1` | UI del explorador | Ajusta puerto según `launchSettings` / Portainer. |

Cabeceras típicas cuando `ReportApiVersions = true` (en rutas versionadas):

| Cabecera | Significado |
|---|---|
| `api-supported-versions` | Versiones activas (hoy `1.0`). |
| `api-deprecated-versions` | Versiones marcadas como deprecadas (vacío hasta que exista). |

---

## 5. OpenAPI y Scalar

| Recurso | URL local típica |
|---|---|
| Esquema OpenAPI 3 | `http://localhost:5088/openapi/v1.json` |
| Explorador Scalar | `http://localhost:5088/scalar/v1` |

- `AddOpenApi` + `BearerSecuritySchemeTransformer` → el documento declara seguridad **Bearer**.
- El SPA y herramientas (`openapi-typescript`, Orval, etc.) deben apuntar al documento **v1** mientras esa sea la versión productiva.

En Portainer/producción: valorar restringir o desactivar `/openapi` y `/scalar` (ver doc **10**).

---

## 6. Cómo añadir un endpoint en v1

1. DTO en `Contracts/V1/<Contexto>/` si hace falta body/respuesta HTTP.
2. Handler/query ya existentes en `Business` (o crear caso de uso nuevo **sin** sufijo V1).
3. En `Endpoints/V1/<Contexto>/…Endpoints.cs`:
   - mismo `ApiVersionSet` `1.0`, o crear uno igual;
   - `MapGroup("/api/v{version:apiVersion}/...")`;
   - filtros `PermissionFilters` / `RequireAuthorization` según doc **11–12**.
4. Registrar `Map…EndpointsV1` en `Program.cs` si es un archivo nuevo.
5. Actualizar catálogo en **[`10-api-host-y-endpoints.md`](10-api-host-y-endpoints.md)** si el cambio es relevante para el equipo.

Checklist de no-rotura en **v1**:

- No renombrar/quitar campos JSON sin periodo de convivencia.
- No cambiar semántica de códigos de error (`Error.Code`) que el SPA interpreta.
- No reutilizar la misma ruta con otro significado.

---

## 7. Cuándo y cómo introducir v2

Abrir **v2** solo si hay **cambio breaking** que no se pueda absorber en v1 (campos obligatorios nuevos, renombres, rutas distintas, semántica incompatible).

Pasos mínimos:

1. Crear `Endpoints/V2/...` y `Contracts/V2/...`.
2. `HasApiVersion(new ApiVersion(2, 0))` + grupo `/api/v{version:apiVersion}/...`.
3. `Map*EndpointsV2()` en `Program.cs`.
4. Mantener **v1 viva** hasta migrar `ecunexo_admin` (y cualquier integrador).
5. Opcional: marcar v1 como deprecated:

   ```csharp
   .HasApiVersion(new ApiVersion(1, 0))
   .HasDeprecatedApiVersion(new ApiVersion(1, 0)) // cuando toque
   ```

6. Actualizar SPA: `VITE_API_BASE_URL` sigue siendo la base; las rutas pasan de `/api/v1` a `/api/v2` donde corresponda.
7. Documentar en este archivo la fecha de deprecación y la de retiro.

Mientras no exista código en `Endpoints/V2`, la carpeta es solo reserva estructural.

---

## 8. Clientes y despliegue

| Cliente | Contrato |
|---|---|
| `ecunexo_admin` | Prefijo **`/api/v1`** en `apiClient` / services. |
| Nginx (Portainer) | Proxy `/api/` → contenedor API; la versión viaja en el path. |
| Billing (`Facturacion`) | API **aparte**; no comparte el versionado de este host. |

Variables de entorno del host (JWT, peppers, etc.) **no** están versionadas por URL: son configuración de despliegue, no del contrato HTTP. Ver `.env.example` del monorepo Cliente.

---

## 9. Errores comunes

| Síntoma | Causa probable |
|---|---|
| `404` en `/api/auth/login` | Falta el segmento **`v1`**. |
| `404` en `/api/v2/...` | Aún no hay endpoints registrados en v2. |
| OpenAPI sin rutas nuevas | Olvidaste `WithApiVersionSet` o no registraste el `Map*`. |
| SPA apunta a localhost en logos | `VITE_API_BASE_URL` mal en build; en prod vacío = mismo origen (proxy). |

---

## 10. Relación con otros docs

| Doc | Qué aporta |
|---|---|
| **10** | Catálogo completo de endpoints v1 + pipeline del host. |
| **11–12** | Auth, RBAC/ABAC sobre esas rutas. |
| **14** | Onboarding / activate-license (rutas v1). |
| **03** | CPM: paquetes `Asp.Versioning.*`. |

> 📚 Asp.Versioning: [dotnet/aspnet-api-versioning](https://github.com/dotnet/aspnet-api-versioning/wiki).  
> 📚 Skills: `ecunexo-architecture`, `ecunexo-coding-standards`.
