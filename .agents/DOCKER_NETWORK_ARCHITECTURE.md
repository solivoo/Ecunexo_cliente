# 🐳 Arquitectura de Red Docker — EcuNexo Producción
**Servidor:** `150.136.6.60` (Oracle Cloud)  
**Acceso SSH:** `oracle-ecunexo` → usuario `ubuntu`, llave `/home/solivo/Documentos/ecunexo/Oracle/id_rsa`  
**Última revisión:** 2026-09-15

---

## 📐 Mapa de Redes y Contenedores (Estado Actual)

```
INTERNET / CLOUDFLARE
        │  443/80
        ▼
┌─────────────────────────────────────────────────────────────┐
│  nginx-proxy-manager  (nginx_default → 172.19.0.3)          │
│  Puertos host: 80, 81, 443                                  │
└──────┬──────────────────────────────────────────────────────┘
       │ proxy_pass por nombre de contenedor / IP host
       │
       ├──► admin.ecunexo.com  → 150.136.6.60:5173  ← ⚠️ VER PROBLEMA #1
       │
       ├──► license.ecunexo.com → license_ecunexo-spa-1:80
       │
       ├──► billing.ecunexo.com → facturacion-ecunexo-billing-api-1:8080
       │
       ├──► portainer.ecunexo.com → portainer:9443
       │
       └──► nginx.ecunexo.com → nginx-proxy-manager:81
```

---

## 🗺️ Redes Docker Existentes

| Red | Subnet | Contenedores miembros |
|-----|--------|----------------------|
| `nginx_default` | `172.19.0.0/16` | nginx-proxy-manager, portainer, ecunexo-cliente-api-1, ecunexo-cliente-spa-1, facturacion-ecunexo-billing-api-1, license_ecunexo-api-1 |
| `license_ecunexo_licencias` | `172.20.0.0/16` | license_ecunexo-postgres-1, license_ecunexo-api-1, license_ecunexo-spa-1, **nginx-proxy-manager** |
| `facturacion-ecunexo_billing` | `172.21.0.0/16` | facturacion-ecunexo-postgres-1, facturacion-ecunexo-billing-api-1 |
| `ecunexo-cliente_cliente` | `172.22.0.0/16` | ecunexo-cliente-postgres-1, ecunexo-cliente-api-1, ecunexo-cliente-spa-1 |

---

## ⚠️ Problemas Detectados

### Problema #1 — `admin.ecunexo.com` apunta a IP del host en lugar del contenedor

**Config actual en NPM (`proxy_host/8.conf`):**
```nginx
set $server  "150.136.6.60";   # ← IP del HOST, no el contenedor
set $port    5173;
```

**¿Por qué falla tras redeploy?**  
Cuando haces `docker compose up --build` para `ecunexo-cliente`, el contenedor `ecunexo-cliente-spa-1` puede recibir una IP diferente en `172.22.0.x`. El puerto `5173` sí está mapeado al host, pero:
- Esta configuración **no usa Docker DNS** (nombre de contenedor), sino la IP física.
- Si el puerto del host cambia, el proxy falla.
- Es un **doble salto innecesario**: Internet → NPM → host:5173 → spa-container.

**Solución correcta:** Usar nombre de contenedor (como hacen los demás proxies).

---

### Problema #2 — `ecunexo-cliente-spa-1` NO está correctamente integrada en `nginx_default` para resolución DNS

Aunque el contenedor aparece en `nginx_default` (porque fue conectado manualmente), si se hace un redeploy del stack (`docker compose down && up`), **el contenedor nuevo pierde esa membresía manual** y NPM ya no puede resolver el nombre. La config actual cae de vuelta a usar la IP del host como workaround.

**Causa raíz:** La red `nginx_default` no está declarada en el `docker-compose.yml` del stack cliente como red externa.

---

### Problema #3 — `billing.ecunexo.com` apunta al contenedor por nombre pero solo funciona porque está en `nginx_default`

Funciona correctamente hoy. Pero si se rehace el stack de facturación sin declarar `nginx_default` como externa, se rompe igual.

---

## ✅ Arquitectura Objetivo (Recomendada)

### Principio clave
> **NPM solo puede resolver contenedores por nombre si comparte red con ellos.**  
> Cada contenedor que NPM necesite alcanzar debe estar en `nginx_default` y esa membresía debe estar **declarada en el docker-compose.yml** del stack correspondiente para que sobreviva a un redeploy.

### Diagrama objetivo

```
INTERNET / CLOUDFLARE
        │ 443/80
        ▼
┌──────────────────────────────────────────────────────────────┐
│             nginx-proxy-manager (nginx_default)              │
└──┬───────┬────────────┬────────────────┬─────────────────────┘
   │       │            │                │
   ▼       ▼            ▼                ▼
[spa]  [lic-spa]  [billing-api]    [lic-api]
  │ (nginx_default + cliente)  (billing + nginx_default)
  │
  ▼
[api] ←── misma red interna del stack
  │
  ▼
[postgres] ←── SOLO red interna, NUNCA expuesto
```

### Regla de membresía de redes

| Contenedor | Redes que debe tener |
|-----------|---------------------|
| `nginx-proxy-manager` | `nginx_default` (siempre, es su red propia) |
| `ecunexo-cliente-spa-1` | `ecunexo-cliente_cliente` (interna) + `nginx_default` (para NPM) |
| `ecunexo-cliente-api-1` | `ecunexo-cliente_cliente` (interna) — NPM lo alcanza via spa |
| `facturacion-ecunexo-billing-api-1` | `facturacion-ecunexo_billing` + `nginx_default` ✅ |
| `license_ecunexo-spa-1` | `license_ecunexo_licencias` + `nginx_default` |
| `license_ecunexo-api-1` | `license_ecunexo_licencias` + `nginx_default` ✅ |
| `*-postgres-*` | Solo la red interna del stack. **NUNCA** en `nginx_default` |

---

## 🔧 Corrección Inmediata — `admin.ecunexo.com`

### Paso 1: Declarar `nginx_default` como red externa en el stack cliente

Editar `docker-compose.yml` del stack cliente:

```yaml
# Al final del docker-compose.yml — sección networks
networks:
  cliente:
    driver: bridge

  npm_network:
    external: true
    name: nginx_default    # ← nombre exacto de la red de NPM en el servidor
```

Y en el servicio `spa`, agregar la red `npm_network`:

```yaml
services:
  spa:
    # ... resto de la config ...
    networks:
      - cliente       # para comunicarse con la api
      - npm_network   # para que NPM pueda resolverlo por nombre
```

> **El servicio `postgres` NO debe tener `npm_network`.**

### Paso 2: Cambiar el proxy host en NPM

En NPM → Proxy Hosts → `admin.ecunexo.com` → Edit:

| Campo | Valor actual ❌ | Valor correcto ✅ |
|-------|----------------|------------------|
| **Forward Hostname** | `150.136.6.60` | `ecunexo-cliente-spa-1` |
| **Forward Port** | `5173` | `80` |

### Paso 3: Aplicar redeploy

```bash
ssh oracle-ecunexo "cd /ruta/al/stack/cliente && sudo docker compose down && sudo docker compose up -d"
```

Después del redeploy, el contenedor spa ya tendrá automáticamente ambas redes declaradas en el compose.

---

## 📋 Reglas de Diseño — Para cada nuevo stack/deploy

### 1. Cada stack tiene su propia red interna (aislamiento)
```yaml
networks:
  interna:
    driver: bridge   # solo para servicios de este stack
```

### 2. Solo los contenedores que NPM proxea directamente van a `nginx_default`
- SPAs: sí (NPM → SPA → API via red interna)
- APIs: solo si NPM las proxea directamente
- Postgres: NUNCA

```yaml
networks:
  interna:
    driver: bridge
  npm_network:
    external: true
    name: nginx_default
```

### 3. El Postgres nunca sale de su red interna
```yaml
services:
  postgres:
    networks:
      - interna    # solo esto
    # sin ports expuestos al host
```

### 4. NPM SIEMPRE resuelve por nombre de contenedor, nunca por IP
```nginx
# ✅ CORRECTO — sobrevive a reinicios y cambios de IP
set $server  "ecunexo-cliente-spa-1";
set $port    80;

# ❌ INCORRECTO — se rompe tras redeploy
set $server  "150.136.6.60";
set $port    5173;
```

### 5. La SPA hace proxy interno a la API por nombre de servicio Docker
```nginx
# En el nginx.conf de la SPA (dentro del contenedor):
location /api/ {
    proxy_pass http://api:8080/api/;   # "api" = nombre del servicio en docker-compose
}
```

### 6. Comunicación cross-stack
- Usar URL pública HTTPS si no es frecuente (ej. `https://license.ecunexo.com/api/...`).
- Si es frecuente y de baja latencia, agregar ambos contenedores a una **red compartida dedicada**:
  ```yaml
  networks:
    ecunexo_shared:
      external: true
      name: ecunexo_internal_shared
  ```

---

## 🚀 Estado de Contenedores (2026-09-15)

| Contenedor | IP interna | En nginx_default | Puerto host | Estado |
|-----------|-----------|------------------|-------------|--------|
| `nginx-proxy-manager` | `172.19.0.3` | ✅ nativo | `80, 81, 443` | ✅ Up 7d |
| `portainer` | `172.19.0.2` | ✅ | `8000, 9443` | ✅ Up 7d |
| `ecunexo-cliente-spa-1` | `172.22.0.4` | ✅ manual* | `5173→80` | ✅ Up 12h |
| `ecunexo-cliente-api-1` | `172.22.0.3` | ✅ manual* | `5088→8080` | ✅ Up 12h |
| `ecunexo-cliente-postgres-1` | `172.22.0.2` | ❌ correcto | — | ✅ Up 12h healthy |
| `facturacion-ecunexo-billing-api-1` | `172.21.0.3` | ✅ | `8083→8080` | ✅ Up 12h |
| `facturacion-ecunexo-postgres-1` | `172.21.0.2` | ❌ correcto | — | ✅ Up 12h healthy |
| `license_ecunexo-spa-1` | `172.20.0.4` | ⚠️ via licencias | `5174→80` | ✅ Up 14h |
| `license_ecunexo-api-1` | `172.20.0.3` | ✅ | `5090→8080` | ✅ Up 14h |
| `license_ecunexo-postgres-1` | `172.20.0.2` | ❌ correcto | — | ✅ Up 14h healthy |
| `moodle-moodle-1` | moodle_default | ❌ | — | ⛔ Exited 3d |
| `moodle-postgres-1` | moodle_default | ❌ | — | ⛔ Exited 3d |
| `moodle-redis-1` | moodle_default | ❌ | — | ⛔ Exited 3d |

> **\* manual** = conectado con `docker network connect` manualmente. Se pierde tras `docker compose down`.  
> Para hacerlo permanente, declarar `nginx_default` como red externa en el compose.

---

## 🔄 Checklist de Deploy Seguro

Antes y después de hacer redeploy de cualquier stack:

```bash
# 1. Verificar que NPM puede resolver el contenedor por nombre
ssh oracle-ecunexo "sudo docker exec nginx-proxy-manager nslookup ecunexo-cliente-spa-1"

# 2. Verificar redes del contenedor recién desplegado
ssh oracle-ecunexo "sudo docker inspect ecunexo-cliente-spa-1 --format '{{range \$k, \$v := .NetworkSettings.Networks}}{{printf \"%s -> %s\n\" \$k \$v.IPAddress}}{{end}}'"

# 3. Verificar conectividad NPM → SPA
ssh oracle-ecunexo "sudo docker exec nginx-proxy-manager wget -qO- --timeout=3 http://ecunexo-cliente-spa-1:80 2>&1 | head -3"

# 4. Verificar conectividad SPA → API (red interna del stack)
ssh oracle-ecunexo "sudo docker exec ecunexo-cliente-spa-1 wget -qO- --timeout=3 http://api:8080/health 2>&1"

# 5. Si el contenedor perdió nginx_default (solución temporal hasta poner en compose):
ssh oracle-ecunexo "sudo docker network connect nginx_default ecunexo-cliente-spa-1"
```

---

## 💡 Resumen de Acciones Pendientes

| Prioridad | Acción | Stack afectado |
|-----------|--------|---------------|
| 🔴 Alta | Cambiar NPM `admin.ecunexo.com` de `150.136.6.60:5173` a `ecunexo-cliente-spa-1:80` | NPM |
| 🔴 Alta | Declarar `nginx_default` como red externa en `docker-compose.yml` del stack Cliente | ecunexo/Cliente |
| 🟡 Media | Verificar que el stack Licencias también declara `nginx_default` como externa en su compose | license_ecunexo |
| 🟡 Media | Verificar que el stack Facturación declara `nginx_default` como externa en su compose | facturacion-ecunexo |
| 🟢 Baja | Limpiar o levantar los contenedores de Moodle (llevan 3 días caídos) | moodle |
