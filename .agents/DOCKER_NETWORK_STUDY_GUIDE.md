# 🐳 Cómo funciona la red Docker de EcuNexo
> Guía didáctica para estudiar la arquitectura del servidor de producción `150.136.6.60`

---

## 1️⃣ El concepto base — ¿Qué es una red Docker?

Piensa en las redes Docker como **cuartos dentro de un edificio**.  
Los contenedores que están en el mismo cuarto se pueden ver y hablar entre sí.  
Los que están en cuartos distintos **no se ven**, aunque estén en el mismo servidor físico.

```
┌─────────────────────────────────────────────────────────────────┐
│                   SERVIDOR  150.136.6.60                        │
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │   Cuarto A   │    │   Cuarto B   │    │   Cuarto C   │     │
│   │              │    │              │    │              │     │
│   │  contenedor1 │    │  contenedor3 │    │  contenedor5 │     │
│   │  contenedor2 │    │  contenedor4 │    │  contenedor6 │     │
│   └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                 │
│   ✅ 1 habla con 2    ✅ 3 habla con 4    ✅ 5 habla con 6      │
│   ❌ 1 NO ve a 3      ❌ 2 NO ve a 5      ❌ 4 NO ve a 6        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2️⃣ El flujo completo — De internet hasta la base de datos

```mermaid
flowchart TD
    A["☁️ USUARIO EN INTERNET"]
    B["🛡️ CLOUDFLARE\nHTTPS / DDoS protection"]
    C["🔀 NGINX PROXY MANAGER\n150.136.6.60:80 / 443"]

    D["🖥️ ecunexo-cliente-spa-1\n(SPA Admin)"]
    E["⚙️ ecunexo-cliente-api-1\n(.NET API)"]
    F["🗄️ ecunexo-cliente-postgres-1\nBD: ecunexo"]

    G["🖥️ license_ecunexo-spa-1\n(SPA Licencias)"]
    H["⚙️ license_ecunexo-api-1\n(.NET API)"]
    I["🗄️ license_ecunexo-postgres-1\nBD: licensing_ecunexo"]

    J["⚙️ facturacion-ecunexo-billing-api-1\n(.NET Billing API)"]
    K["🗄️ facturacion-ecunexo-postgres-1\nBD: billing"]

    A --> B --> C

    C -->|"admin.ecunexo.com"| D
    C -->|"license.ecunexo.com"| G
    C -->|"billing.ecunexo.com"| J

    D -->|"proxy /api → api:8080\n(red interna cliente)"| E
    E -->|"Host=postgres:5432\n(red interna cliente)"| F

    G -->|"proxy /api → api:8080\n(red interna licencias)"| H
    H -->|"Host=postgres:5432\n(red interna licencias)"| I

    J -->|"Host=postgres:5432\n(red interna billing)"| K

    style A fill:#2d6a9f,color:#fff
    style B fill:#f48024,color:#fff
    style C fill:#c07a00,color:#fff
    style D fill:#1a6b3a,color:#fff
    style E fill:#1a6b3a,color:#fff
    style F fill:#0d4a28,color:#fff
    style G fill:#1a3a6b,color:#fff
    style H fill:#1a3a6b,color:#fff
    style I fill:#0d2a4a,color:#fff
    style J fill:#6b1a1a,color:#fff
    style K fill:#4a0d0d,color:#fff
```

---

## 3️⃣ Las redes Docker — El mapa de los "cuartos"

```mermaid
flowchart LR
    subgraph nginx_default["🟠 nginx_default  172.19.0.0/16\n(Red de NPM — DNS público interno)"]
        NPM["nginx-proxy-manager\n172.19.0.3"]
        PORT["portainer\n172.19.0.2"]
        SPA_C["ecunexo-cliente-spa-1\n172.19.0.5"]
        SPA_L["license_ecunexo-spa-1\n172.19.0.6"]
        API_C["ecunexo-cliente-api-1\n172.19.0.6"]
        API_L["license_ecunexo-api-1\n172.19.0.7"]
        API_B["facturacion-ecunexo-billing-api-1\n172.19.0.4"]
    end

    subgraph shared["🟣 ecunexo_shared  172.23.0.0/16\n(Puente cross-stack)"]
        PG_C2["ecunexo-cliente-postgres-1\n172.23.0.4"]
        API_B2["billing-api\n172.23.0.3"]
        API_L2["license-api\n172.23.0.2"]
    end

    subgraph cliente["🟢 ecunexo-cliente_cliente  172.22.0.0/16\n(Stack Admin — aislado)"]
        SPA_C2["ecunexo-cliente-spa-1\n172.22.0.4"]
        API_C2["ecunexo-cliente-api-1\n172.22.0.3"]
        PG_C3["🔒 ecunexo-cliente-postgres-1\n172.22.0.2"]
    end

    subgraph licencias["🔵 license_ecunexo_licencias  172.20.0.0/16\n(Stack Licencias — aislado)"]
        SPA_L2["license_ecunexo-spa-1\n172.20.0.4"]
        API_L2b["license_ecunexo-api-1\n172.20.0.3"]
        PG_L["🔒 license_ecunexo-postgres-1\n172.20.0.2"]
    end

    subgraph billing["🔴 facturacion-ecunexo_billing  172.21.0.0/16\n(Stack Billing — aislado)"]
        API_B3["billing-api\n172.21.0.3"]
        PG_B["🔒 facturacion-ecunexo-postgres-1\n172.21.0.2"]
    end
```

---

## 4️⃣ ¿Por qué un contenedor puede estar en VARIAS redes?

Un contenedor puede tener **varias tarjetas de red** virtuales, una por cada red Docker a la que pertenezca.

```
┌─────────────────────────────────────────────────────────┐
│         ecunexo-cliente-spa-1                           │
│                                                         │
│   Tarjeta 1 ──► ecunexo-cliente_cliente (172.22.0.4)   │
│                  └── habla con: api, postgres           │
│                                                         │
│   Tarjeta 2 ──► nginx_default (172.19.0.5)             │
│                  └── habla con: NPM (recibe tráfico)    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│         license_ecunexo-api-1                           │
│                                                         │
│   Tarjeta 1 ──► license_ecunexo_licencias (172.20.0.3) │
│                  └── habla con: su spa, su postgres     │
│                                                         │
│   Tarjeta 2 ──► nginx_default (172.19.0.7)             │
│                  └── habla con: NPM                     │
│                                                         │
│   Tarjeta 3 ──► ecunexo_shared (172.23.0.2)            │
│                  └── habla con: ecunexo-cliente-postgres│
└─────────────────────────────────────────────────────────┘
```

---

## 5️⃣ Cómo NPM redirige el tráfico (proxy por nombre)

```mermaid
sequenceDiagram
    actor U as 👤 Usuario
    participant CF as ☁️ Cloudflare
    participant NPM as 🔀 NPM
    participant SPA as 🖥️ spa-cliente
    participant API as ⚙️ api-cliente
    participant PG as 🗄️ postgres-cliente

    U->>CF: GET https://admin.ecunexo.com
    CF->>NPM: HTTP/HTTPS :443
    Note over NPM: Busca "admin.ecunexo.com"<br/>en su config → proxy_pass<br/>a ecunexo-cliente-spa-1:80
    NPM->>SPA: HTTP :80 (via nginx_default)
    Note over SPA: Nginx interno de la SPA<br/>detecta /api/ → proxy_pass<br/>a api:8080 (red interna)
    SPA->>API: HTTP :8080 (via ecunexo-cliente_cliente)
    API->>PG: SQL :5432 (via ecunexo-cliente_cliente)
    PG-->>API: Resultado
    API-->>SPA: JSON response
    SPA-->>NPM: HTML/JSON
    NPM-->>CF: Response
    CF-->>U: HTTPS response
```

---

## 6️⃣ La red `ecunexo_shared` — El puente cross-stack

```mermaid
flowchart TD
    subgraph shared["🟣 ecunexo_shared — El puente"]
        direction LR
        BA["billing-api\n172.23.0.3"]
        LA["license-api\n172.23.0.2"]
        PG["ecunexo-cliente-postgres-1\n172.23.0.4\n(BD: ecunexo)"]
        BA -->|"ConnectionStrings__AdminDb\nHost=ecunexo-cliente-postgres-1"| PG
        LA -->|"ConnectionStrings__AdminDb\nHost=ecunexo-cliente-postgres-1"| PG
    end

    subgraph B["Stack Facturación"]
        BA2["billing-api"] --- BPG["🔒 billing-postgres\n(BD: billing)"]
    end

    subgraph L["Stack Licencias"]
        LA2["license-api"] --- LPG["🔒 license-postgres\n(BD: licensing_ecunexo)"]
    end

    BA2 -.->|"también en ecunexo_shared"| BA
    LA2 -.->|"también en ecunexo_shared"| LA

    style shared fill:#3a1a5e,color:#fff
    style PG fill:#1a0d3a,color:#fff
```

> **¿Por qué existe `ecunexo_shared`?**  
> La API de facturación necesita leer el inventario del cliente.  
> La API de licencias necesita cambiar configuraciones del tenant.  
> Ambas apuntan a `ConnectionStrings__AdminDb` → `ecunexo-cliente-postgres-1`.  
> Sin `ecunexo_shared`, los contenedores están en redes distintas y **no se ven**.

---

## 7️⃣ El problema clásico — ¿Por qué se rompe tras un redeploy?

```
ANTES (manual, frágil):
─────────────────────────────────────────────────────────────
  docker compose up -d          → contenedor nuevo sin redes extra
  docker network connect ...    → conexión manual (se pierde en el siguiente down)

  NPM → proxy_pass 150.136.6.60:5173  ← usa IP del HOST, no nombre de contenedor
  Si el puerto cambia → 💥 ROTO

DESPUÉS (declarativo, robusto):
─────────────────────────────────────────────────────────────
  docker-compose.yml declara:
    networks:
      npm_network:
        external: true
        name: nginx_default
      ecunexo_shared:
        external: true
        name: ecunexo_shared

  docker compose up -d   → contenedor nuevo YA tiene las redes correctas ✅
  NPM → proxy_pass ecunexo-cliente-spa-1:80  ← nombre de contenedor, siempre funciona ✅
```

---

## 8️⃣ Reglas de oro para no romper nada

```
┌─────────────────────────────────────────────────────────────────┐
│  REGLA 1                                                        │
│  NPM solo puede hacer proxy a contenedores que comparten        │
│  nginx_default con él. Siempre declara npm_network en el        │
│  compose del servicio que NPM proxea.                           │
├─────────────────────────────────────────────────────────────────┤
│  REGLA 2                                                        │
│  El postgres NUNCA va a nginx_default ni a ecunexo_shared       │
│  salvo que sea el postgres del cliente (es el compartido).      │
│  Agregar postgres a redes externas = riesgo de seguridad.       │
├─────────────────────────────────────────────────────────────────┤
│  REGLA 3                                                        │
│  NPM siempre usa nombre de contenedor, NUNCA la IP del host.    │
│  Las IPs de contenedores cambian en cada redeploy.              │
│  Los nombres de contenedores son estables.                      │
├─────────────────────────────────────────────────────────────────┤
│  REGLA 4                                                        │
│  La SPA hace proxy interno a la API por nombre de SERVICIO      │
│  Docker (no el nombre del contenedor). El servicio se llama     │
│  "api" en el compose → proxy_pass http://api:8080/              │
├─────────────────────────────────────────────────────────────────┤
│  REGLA 5                                                        │
│  Antes de crear una nueva red compartida, verifica que          │
│  docker network create <nombre> se ejecuta antes del deploy.    │
│  Si la red no existe, el compose falla al arrancar.             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9️⃣ Mapa de membresías por contenedor

| Contenedor | `nginx_default` | `ecunexo_shared` | Red interna del stack |
|-----------|:--------------:|:----------------:|:---------------------:|
| nginx-proxy-manager | ✅ (nativo) | ❌ | ❌ |
| portainer | ✅ | ❌ | ❌ |
| **ecunexo-cliente-spa-1** | ✅ | ❌ | ✅ `172.22.x` |
| **ecunexo-cliente-api-1** | ✅ | ❌ | ✅ `172.22.x` |
| 🔒 ecunexo-cliente-postgres-1 | ❌ | ✅ | ✅ `172.22.x` |
| **license_ecunexo-spa-1** | ✅ | ❌ | ✅ `172.20.x` |
| **license_ecunexo-api-1** | ✅ | ✅ | ✅ `172.20.x` |
| 🔒 license_ecunexo-postgres-1 | ❌ | ❌ | ✅ `172.20.x` |
| **billing-api** | ✅ | ✅ | ✅ `172.21.x` |
| 🔒 billing-postgres | ❌ | ❌ | ✅ `172.21.x` |

---

## 🔟 Checklist antes de cada deploy

```
[ ] 1. ¿El docker-compose.yml declara npm_network como externa?
       networks:
         npm_network:
           external: true
           name: nginx_default

[ ] 2. ¿El servicio que NPM proxea tiene npm_network en su sección networks?

[ ] 3. ¿Si necesita acceso cross-stack, declara ecunexo_shared como externa?
       networks:
         ecunexo_shared:
           external: true
           name: ecunexo_shared

[ ] 4. ¿La red ecunexo_shared ya existe en el servidor?
       Verificar: ssh oracle-ecunexo "sudo docker network ls | grep shared"
       Crear si no: ssh oracle-ecunexo "sudo docker network create ecunexo_shared"

[ ] 5. ¿En NPM el proxy host usa nombre de contenedor, no IP del host?
       ✅ Forward Host: ecunexo-cliente-spa-1  Port: 80
       ❌ Forward Host: 150.136.6.60          Port: 5173

[ ] 6. ¿El postgres del stack SOLO está en la red interna?
       (no debe aparecer en nginx_default ni en ecunexo_shared, salvo ecunexo-cliente-postgres)
```
