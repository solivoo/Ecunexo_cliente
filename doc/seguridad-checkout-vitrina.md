# Seguridad del checkout de la vitrina

Referencia operativa de las medidas anti-abuso, de reserva de stock y de pagos implementadas
para el checkout público (invitado) de la vitrina multi-dominio.

- **Alcance:** endpoints públicos `/api/v1/public/tenants/{tenantId}/storefront/*`, reserva de
  inventario del pedido ecommerce, y la confirmación de pago por transferencia con comprobante
  por WhatsApp.
- **Repos implicados:** `Monorepo/Cliente` (API + admin) y `Monorepo/ecommerce` (vitrina).

---

## 1. Flujo y superficie de ataque

```text
Comprador → Cloudflare → NPM (VPS Oracle) → API Cliente (5088, solo Tailscale/NPM)
Vitrina   → VPS front (NPM) → nginx del storefront → Tailscale → API Cliente (5088)
```

- Endpoints públicos expuestos por la vitrina: `products`, `facets`, `checkout-options` y
  `orders` (POST).
- El puerto `5088` del API **no es alcanzable desde internet** (verificado: 5088, 5090, 5173,
  5174 y 8083 cerrados; solo 80/443 del NPM están abiertos).
- El navegador nunca habla con el API directamente: el salto es nginx → Tailscale, por lo que
  no hay CORS ni exposición del precio o del stock crudo.

---

## 2. Medidas implementadas

| # | Medida | Archivos clave | Beneficio | Contras / límites |
|---|---|---|---|---|
| 1 | Reserva transaccional con concurrencia optimista (`xmin`) | `EcuNexo.Core/Inventory/Stock.cs`, `EcuNexo.Data/Configurations/StockConfiguration.cs`, `EcuNexo.Data/EfUnitOfWork.cs`, `CreateEcommerceOrderHandler.cs` | Evita sobreventa: dos compras simultáneas no pueden reservar la misma unidad; la segunda falla con `409 stock_conflict` | La unidad queda reservada aunque el pago no llegue (se libera por cancelación o TTL) |
| 2 | Idempotencia por `requestId` | `EcuNexo.Core/Ecommerce/EcommerceOrder.cs`, migración `20260926225618_AddEcommerceOrderClientRequestId`, `CreateEcommerceOrderHandler.cs` | Un doble clic o reintento devuelve el mismo pedido sin duplicar reserva ni pedido | Si el navegador genera un `requestId` distinto en cada intento, sí se crean pedidos distintos (lo mitiga el tope de pendientes) |
| 3 | Precio y costo de envío calculados en el servidor | `CreateEcommerceOrderHandler.cs`, `GetEcommerceCheckoutOptionsHandler.cs`, `CreateStorefrontOrderHandler.cs` | El comprador no puede manipular precios; el envío sale del método configurado por el tenant | Requiere que la lista de precios y el método estén vigentes; si no, el pedido se rechaza |
| 4 | TTL de reserva + worker de expiración | `EcommercePaymentHoldService.cs`, `Workers/EcommercePaymentHoldWorker.cs`, setting `ecommerce.storefront.payment_hold_hours` | Los pedidos impagos liberan stock automáticamente (default 2 h, configurable 1..720) | Un comprador que paga por transferencia después del TTL pierde la reserva (el admin puede re-confirmar si aún hay stock) |
| 5 | Modo "reservar al confirmar pago" | setting `ecommerce.storefront.reserve_on_order`, `EcommerceOrder.StockReserved`, `ConfirmEcommerceOrderPaymentHandler.cs` | Si se desactiva, ningún pedido web bloquea stock hasta que el admin confirma el pago (ideal contra órdenes fantasma) | El stock puede agotarse entre el pedido y la confirmación; el admin vería `insufficient_available` al confirmar |
| 6 | Rate limiting por IP real | `EcuNexo.Api/Security/StorefrontRateLimitPolicies.cs` (`StorefrontRateLimitOptions`), `EcuNexo.Api/Program.cs`, `appsettings.json`, `docker-compose.yml` | Pedidos: 5/10 min; lecturas: 120/min (defaults configurables por env `RateLimits__Storefront__*`). Frena bots y flood de órdenes | NAT/CGNAT comparten IP (oficinas o redes móviles pueden tocar el límite); el nginx de la vitrina sanea `X-Forwarded-For`/`X-Real-IP`/`CF-Connecting-IP` con la IP real |
| 7 | Honeypot + tiempo mínimo de formulario | `CreateStorefrontOrderValidator.cs` (`contactFax`, `formElapsedMs >= 2000`), `ecommerce/src/pages/checkout/CheckoutPage.tsx` | Descarta bots simples sin fricción para el humano | Bots con navegador real lo superan; un gestor de contraseñas podría autocompletar el campo trampa (poco probable por el nombre `contactFax`) |
| 8 | Tope de pedidos pendientes por contacto | `CreateStorefrontOrderHandler.cs`, setting `ecommerce.storefront.max_pending_orders` | Una misma persona/bot no puede acaparar el catálogo con pedidos impagos (default 3, rango 1..50 configurable por tienda) | Un cliente legítimo con el tope de pedidos pendientes debe esperar a que se confirmen/cancelen |
| 9 | Lista de bloqueo de contactos | `EcuNexo.Core/Ecommerce/EcommerceBlockedContact.cs`, migración `20260926234318_AddEcommerceBlockedContacts`, endpoints admin `ecommerce/blocked-contacts` | Bloqueo manual de email/teléfono reincidente; el checkout responde `ecommerce.checkout.blocked_contact` | Bloqueos manuales; un teléfono compartido puede generar falsos positivos |
| 10 | Puertos cerrados + Tailscale + forwarded headers confiables | `Program.cs` (`UseForwardedHeaders`), despliegue (NPM/Tailscale) | El API no es alcanzable desde internet, así que no se puede falsear `CF-Connecting-IP` ni saltar el rate limit por IP | Si algún día se publica el `5088`, el rate limit por IP deja de ser confiable |
| 11 | Comprobante por WhatsApp | `ecommerce/src/pages/checkout/OrderConfirmedPage.tsx`, `checkoutApi.ts`, setting `contact_whatsapp` | Cierra el flujo de transferencia sin cuentas: mensaje prellenado con pedido y total | El comprobante vive en WhatsApp (no adjunto al pedido); requiere que el admin lo coteje a mano |
| 12 | Trazabilidad mínima | `requestId` + `ClientRequestId`, timeline del pedido, logs del API con email enmascarado/IP/UA | Permite auditar y bloquear abusos | Retención de logs/IP: cuidado con privacidad |
| 13 | Turnstile invisible (Cloudflare) | `TurnstileVerifier.cs`, `TurnstileOptions.cs`, `Program.cs`, `ecommerce/src/lib/turnstile.tsx`, `CheckoutPage.tsx` | Frena bots con navegador real sin fricción; deshabilitado si no hay secret | Depende de Cloudflare (site/secret key y dominios del widget); una llamada de red extra al `siteverify` |
| 14 | Comprobante subido al pedido | `UploadStorefrontPaymentProofHandler.cs`, `EcommerceOrder.PaymentProof*`, migración `20260927000732_AddEcommerceOrderPaymentProof`, `OrderConfirmedPage.tsx`, `EcommerceOrderDetailPage.tsx` | Evidencia del pago dentro del sistema (bucket privado + URL prefirmada en el admin), sin depender de WhatsApp | Un archivo por pedido (reemplazable mientras esté pendiente); límite 5 MB y tipos JPG/PNG/WEBP/PDF; requiere el token del pedido |
| 15 | Correos de pedido (best-effort) | `EcommerceOrderEmailNotifier.cs`, setting `ecommerce.storefront.orders_notification_email`, handlers de pedido | Aviso al equipo al entrar un pedido/comprobante y al cliente (confirmación, pago, despacho) | No bloquea el flujo si falla; requiere SMTP del tenant configurado para enviar de verdad |
| 16 | UI de bloqueos y spam en el admin | `StorefrontSettingsPage.tsx`, `BlockEcommerceContactModal.tsx`, `MarkEcommerceOrderSpamModal.tsx` | Operación: bloquear email/teléfono y anular pedidos basura en dos clics | Acción manual; los bloqueos no se sincronizan con Cloudflare |

---

## 3. Ciclo de vida de la reserva

1. **Crear pedido** (`CreateEcommerceOrderHandler`): por cada ítem `Stock.Reserve(cantidad)`.
   Si algún ítem no alcanza, el pedido no se guarda.
2. **Confirmar pago** (`ConfirmEcommerceOrderPaymentHandler`): si el pedido se creó con
   `StockReserved = false` (modo reservar al confirmar), reserva recién aquí.
3. **Cancelar** (`CancelEcommerceOrderHandler`): libera la reserva solo si estaba reservada.
4. **Despachar** (`ShipEcommerceOrderHandler`): `CommitReservation` descuenta físico y reserva;
   si no estaba reservado, reserva y luego compromete.
5. **Expirar** (`EcommercePaymentHoldWorker`): cada 15 min cancela pedidos `Placed` +
   `PaymentPending` que superan `payment_hold_hours` del tenant, liberando la reserva.

---

## 4. Configuración

En el admin: **Ecommerce → Configuración de tienda** (`StorefrontSettingsPage.tsx`).

| Setting | Default | Descripción |
|---|---|---|
| `ecommerce.storefront.payment_methods` | `["BankTransfer"]` | Métodos de pago habilitados |
| `ecommerce.storefront.shipping_methods` | `[{Courier, 0}]` | Métodos de envío con costo |
| `ecommerce.storefront.bank_transfer_instructions` | vacío | Datos bancarios mostrados al comprador |
| `ecommerce.storefront.payment_hold_hours` | **2** | Horas de reserva sin pago confirmado |
| `ecommerce.storefront.reserve_on_order` | `true` | Reservar stock al crear el pedido (false = reservar al confirmar pago) |
| `ecommerce.storefront.contact_whatsapp` | vacío | WhatsApp de la tienda para el comprobante |
| `ecommerce.storefront.orders_notification_email` | vacío | Correo del equipo que recibe avisos de pedidos y comprobantes |
| `ecommerce.storefront.max_pending_orders` | **3** | Máximo de pedidos pendientes por contacto (1..50) antes de rechazar el checkout |

Turnstile se configura por variables de entorno del API (`Turnstile__SiteKey`,
`Turnstile__SecretKey`); si el secret está vacío, el captcha queda deshabilitado y el flujo sigue
igual. La vitrina obtiene el site key desde `checkout-options` (no requiere rebuild).

Los rate limits del storefront se configuran por variables de entorno del API (sin deploy de
código) y tienen defaults seguros en `appsettings.json` (`RateLimits:Storefront`):

| Env | Default | Descripción |
|---|---|---|
| `RATE_LIMITS_ORDERS_PERMIT` | `5` | Pedidos permitidos por ventana e IP real |
| `RATE_LIMITS_ORDERS_WINDOW_MIN` | `10` | Minutos de la ventana de pedidos |
| `RATE_LIMITS_READ_PERMIT` | `120` | Lecturas permitidas por ventana e IP real |
| `RATE_LIMITS_READ_WINDOW_MIN` | `1` | Minutos de la ventana de lecturas |

El nginx de la vitrina calcula la IP del comprador (`map $http_x_real_ip`) y la envía saneada al
API en `X-Forwarded-For`, `X-Real-IP` y `CF-Connecting-IP`, descartando los valores que mande el
cliente.

---

## 5. Verificación operativa

```bash
# Puertos expuestos (deben dar "cerrado" salvo 80/443)
for P in 5088 5090 5173 5174 8083; do timeout 5 bash -c "</dev/tcp/<IP_API>/<PUERTO>" && echo abierto || echo cerrado; done

# API por Tailscale (debe responder 200)
curl -s -o /dev/null -w '%{http_code}\n' "http://100.83.245.45:5088/api/v1/public/storefront/resolve?host=www.everchic.ec"

# Rate limit del checkout (6+ POST seguidos deben devolver 429 y el código ecommerce.checkout.rate_limited)
```

Otros códigos esperados del checkout: `ecommerce.checkout.invalid_form`,
`ecommerce.checkout.too_many_pending`, `ecommerce.checkout.blocked_contact`,
`ecommerce.order.stock_conflict`.

---

## 6. Pendientes y mejoras sugeridas

- **Configurar Turnstile** en producción: widget en Cloudflare con los dominios de la vitrina y
  las env `Turnstile__SiteKey`/`Turnstile__SecretKey` en el stack del API.
- **Notificar al cliente por correo los cambios de estado** ya está cubierto (pago confirmado y
  despachado); evaluar recordatorio automático antes de expirar la reserva.
- **Conteos de facetas dinámicos** (cantidad de resultados por filtro) y caché del catálogo
  público: mejora ajena al checkout, pendiente de evaluar según tráfico.
