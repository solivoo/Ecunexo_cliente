# 07 — Dominio, DDD y capas (vocabulario para quien viene de JS u otros stacks)

## Qué es este documento

Consolida **conceptos que suelen confundirse al estudiar** Clean Architecture y DDD en EcuNexo. Complementa `00-introduccion.md` y el glosario de `README.md`.

---

## Dominio (en DDD / Clean Architecture)

En este proyecto, **"dominio" no es un dominio HTTP** (como `https://api.ejemplo.com`). Es el **ámbito del negocio** que el software modela: inventarios, bodegas, tenants, productos, permisos, y las **reglas** que deben cumplirse.

> 💡 **Dominio ≈ conceptos + lenguaje + reglas de negocio** que existen aunque no hubiera web ni base de datos.

Para ser más fino: a veces se habla del **"modelo de dominio"** (las ideas en código) además de **"lógica de negocio"** (las invariantes y transiciones válidas). Ambos conviven sobre todo en **`EcuNexo.Core`**.

---

## ¿"Dominio" = Api + Business + Core + Data?

**No.** Las cuatro capas forman la **solución completa** de la app. Pero en el sentido **estricto** de DDD:

| Capa | Nombre típico | ¿Es el núcleo del dominio? |
|---|---|---|
| `EcuNexo.Core` | Dominio | **Sí** — entidades, agregados, value objects, reglas puras. |
| `EcuNexo.Business` | Aplicación | Orquestación y casos de uso que **usan** el dominio. |
| `EcuNexo.Data` | Infraestructura | Persistencia (EF, PostgreSQL). **Adapta** el dominio a tablas. |
| `EcuNexo.Api` | Presentación | HTTP, DTOs, versión de API. **Expone** casos de uso al exterior. |

> 💡 **Dominio (fino) = Core.** Las demás capas **dependen hacia dentro** y sirven al modelo, pero no son el modelo en sí.

---

## DDD (Domain-Driven Design)

**DDD** = diseño **orientado al dominio**: el código refleja el problema de negocio y un **lenguaje ubicuo** compartido (mismo vocabulario en reuniones y en clases).

Ideas que ya ves en el repo:

- **Bounded context**: frontera de significado (`Tenancy`, `Catalog`, etc.).
- **Aggregate / raíz**: punto de entrada y consistencia (`Tenant`, `Product`).
- **Value object**: sin identidad propia, descrito por valores (`ServicePlan`).
- **Domain events**: algo ocurrió en el modelo (`IDomainEvent` + cola en `AggregateRoot`).

> 📚 Lectura de referencia: Eric Evans, *Domain-Driven Design*; Vaughn Vernon, *Implementing Domain-Driven Design*.

---

## Carpeta `Common/` dentro de `Core`

**`Common`** = tipos **compartidos entre bounded contexts**, sin ser "un producto" ni "un tenant":

- `Result`, `Error` — forma de expresar éxito o fallo esperado.
- `Entity`, `AggregateRoot`, `IDomainEvent` — primitivas del modelo.

No reemplaza un contexto (`Tenancy/`, `Catalog/`): **complementa** a todos.

---

## Ciclo "tabla" vs ciclo "API"

- La **tabla en PostgreSQL** aparece al mapear entidades en **`EcuNexo.Data`** (DbContext, configuraciones EF, **migración** aplicada).
- La **API** es el **borde HTTP**; puede existir **después** de tener persistencia, o desarrollarse en paralelo, pero **no es quien crea la tabla**.

Flujo mental end-to-end: **Api → Business → Data → base de datos** (la tabla "nace" en Data + migración).

---

## Relación con esta bitácora y los skills

Este archivo es **pedagógico**. Si choca con `.cursor/skills/`, **manda el skill**.

## Qué estudiar después

- Volver a `05-estructura-carpetas.md` y relacionar cada carpeta `Common/`, `Abstractions/`, `Tenancy/` con lo anterior.
- **08** — Business completo para crear tenant; **09** — Data + migración + host Api (ver `09-…`); **10** — endpoints públicos (ver `10-…`).
