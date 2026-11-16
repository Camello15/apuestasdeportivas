# Configuración necesaria para SPEC-002

Configura los secretos en el gestor de secretos del entorno de ejecución. No reutilices los valores ficticios de `.env.example` ni guardes claves privadas en Git o en `apps/web`.

## Sesiones

- `DATABASE_URL`: conexión TLS al usuario PostgreSQL de runtime. Dale solo los permisos de aplicación; las tablas de auditoría necesitan además el endurecimiento pendiente.
- `MIGRATION_DATABASE_URL`: conexión separada del propietario/migrador. No debe estar disponible para el proceso web en producción.
- `AUDIT_MAINTENANCE_DATABASE_URL`: credencial separada con permisos limitados para borrar eventos de auditoría anteriores al año de retención; úsala solo en la tarea operativa `audit:retention`, nunca en el API web.
- `REDIS_URL`: Redis accesible por el API, con autenticación y TLS (`rediss://`) fuera del desarrollo local.
- `JWT_PRIVATE_KEY` y `JWT_PUBLIC_KEY`: par RSA PEM; guarda la privada solo en el API y proporciona ambos como variables multilínea o con saltos `\\n`.
- `JWT_KEY_ID`: identificador no secreto de la clave activa. El emisor firma con este `kid`; el guard rechaza tokens firmados con otro identificador.
- `JWT_PUBLIC_KEYS`: mapa JSON opcional de `kid` a claves RSA públicas para aceptar tokens no vencidos durante una rotación. Conserva solo las claves previas necesarias para la ventana de 15 minutos y después retíralas.
- `REFRESH_TOKEN_PEPPER`: valor aleatorio secreto de al menos 32 bytes, único por entorno, para HMAC-SHA-256 de refresh tokens.
- `JWT_ISSUER` y `JWT_AUDIENCE`: valores estables y distintos por entorno, compartidos por emisor y validador.
- `WEB_ORIGIN`: origen HTTPS exacto del frontend.
- `API_BASE_URL`: origen HTTPS del API que usa el BFF. Node debe confiar en la cadena TLS; no configures `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- `TRUST_PROXY_HOPS`: número exacto de saltos de proxy inverso confiables para que Express calcule `req.ip`. El valor por defecto es `0` (no confiar en `X-Forwarded-For`). En Render configura `1` si todo el tráfico público de este servicio llega a la aplicación a través de exactamente un proxy administrado por Render. No aumentes el valor para “hacer funcionar” IPs: confirma primero la topología real y evita exponer la instancia por una ruta que omita ese proxy. El API valida enteros entre `0` y `5`.
- `CSRF_SECRET` (variable del servidor Next.js en Vercel, no del navegador): secreto aleatorio de al menos 32 bytes. El BFF firma el nonce CSRF con HMAC-SHA-256 y lo vincula a la cookie refresh (o access si no hay refresh); las solicitudes mutables con cookies de sesión deben presentar el token firmado tanto en cookie como en header. Usa un valor distinto por entorno y no lo expongas con prefijo `NEXT_PUBLIC_`.

## CAPTCHA y correo

- `CAPTCHA_PROVIDER=turnstile`, `CAPTCHA_SECRET_KEY` y `CAPTCHA_EXPECTED_HOSTNAME` deben coincidir con Cloudflare Turnstile. En Next.js configura `NEXT_PUBLIC_CAPTCHA_SITE_KEY` con la clave pública del mismo sitio.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `EMAIL_FROM` deben apuntar a un relay SMTP autenticado. No habilites el flujo público sin proveedor configurado.
- El reenvío de verificación permite como máximo 3 solicitudes por correo normalizado y 10 por IP en una ventana móvil de 60 minutos. Los límites se aplican también a correos inexistentes/verificados, antes de buscar la cuenta, y Redis indisponible impide enviar. El endpoint conserva una respuesta genérica.

## Contraseñas y TOTP

- Mantén `HIBP_TIMEOUT_MS=3000` y `HIBP_MAX_RETRIES=1` como exige la especificación.
- `TOTP_ENCRYPTION_KEY` debe ser una clave aleatoria de 32 bytes codificada en Base64, exclusiva por entorno y respaldada de forma segura. `TOTP_KEY_VERSION` identifica la versión activa. Durante una rotación, conserva claves anteriores en `TOTP_ENCRYPTION_KEYS` como JSON `{ "v1": "<base64>", "v2": "<base64>" }` hasta volver a cifrar las credenciales. Las claves no deben almacenarse en PostgreSQL.

Antes de habilitar tráfico público, ejecuta `PermissionsSeed.apply()` con el procedimiento de despliegue controlado (nunca desde el registro público), configura PostgreSQL/Redis, claves, CAPTCHA, SMTP, HTTPS y CSRF. La rotación de claves y la política de mantenimiento de auditoría requieren procedimientos operativos separados.

Para inicializar el catálogo utiliza `pnpm --filter @apuestas/api auth:seed` después de compilar el API y con `MIGRATION_DATABASE_URL` configurada. La primera cuenta administradora se provisiona, una sola vez, con `ADMIN_PROVISION_EMAIL` de una cuenta activa y verificada mediante `pnpm --filter @apuestas/api admin:provision`. Ambos comandos usan la URL privilegiada de migración, no tienen rutas HTTP y registran la provisión inicial en auditoría.

La retención se ejecuta fuera del servidor web con `pnpm --filter @apuestas/api audit:retention` y `AUDIT_MAINTENANCE_DATABASE_URL`. El rol de mantenimiento debe poder borrar únicamente eventos anteriores al año; las restricciones de tabla y trigger que limitan ese usuario/runtime deben instalarse mediante la migración de hardening pendiente antes de habilitar esta tarea.
