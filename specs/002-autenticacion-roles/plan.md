# Plan de implementación: Autenticación y roles

**Rama**: `feature/spec-2-autenticacion-roles`
**Fecha**: 2026-11-15
**Especificación**: [spec.md](spec.md)
**Fase**: F1 — Identidad y acceso

> Este plan respeta el alcance y las reglas funcionales de SPEC-002. Por instrucción del responsable, este artefacto contiene el plan técnico; no se generan `research.md`, `data-model.md`, contratos, `quickstart.md` ni `tasks.md`.

## Resumen

F1 implementará identidad y autorización dentro de las aplicaciones existentes: Next.js en `apps/web` como interfaz y BFF same-origin para el navegador; NestJS en `apps/api` como autoridad de autenticación, autorización y emisión de credenciales; PostgreSQL/Prisma para usuarios, sesiones, credenciales TOTP, roles y auditoría; Redis para límites temporales y desafíos de autenticación. No se agrega una aplicación ni se implementan billetera, apuestas, retiros, promociones o reportes.

Las contraseñas se almacenarán con Argon2id. Antes de crearlas o restablecerlas, el backend rechazará coincidencias exactas de listas de contraseñas comunes/comprometidas y puntuaciones zxcvbn inferiores a 3/4; comprobará contraseñas comprometidas en Have I Been Pwned Pwned Passwords mediante el protocolo de rango con k-anonimato. No se enviarán contraseñas en texto plano ni hashes completos a terceros. Las sesiones usarán access JWT de 15 minutos y refresh token opaco de 7 días, rotación transaccional y revocación por sesión o por cuenta.

## Contexto técnico

| Área | Decisión |
|---|---|
| Lenguaje y versiones | TypeScript estricto; Node.js `>=20`; configuración actual del monorepo. |
| Aplicaciones | `apps/web` Next.js App Router y `apps/api` NestJS; `packages/shared` solo para tipos no sensibles compartidos si evita duplicación. |
| Dependencias de plataforma | Prisma, PostgreSQL, Redis, Argon2id y las dependencias NestJS existentes. Dependencias de TOTP/JWT/CAPTCHA/correo se seleccionan durante las tareas con revisión de mantenimiento y compatibilidad; no se instala ninguna ahora. |
| Almacenamiento | PostgreSQL es la fuente durable; Redis almacena contadores de abuso y desafíos efímeros. |
| Pruebas previstas | Jest/Supertest para API, Testing Library para UI y Playwright para flujos E2E, según PLAN.md. No se ejecutan en esta etapa. |
| Plataforma | Next.js en Vercel; NestJS, PostgreSQL y Redis en Render. HTTPS obligatorio en los bordes públicos y en la conexión BFF→NestJS, con validación de certificados TLS. |
| Objetivos de rendimiento | PLAN.md y SPEC-002 no fijan latencia ni disponibilidad para F1; no se inventan SLO. Debe medirse Argon2 y la consulta de contraseñas en el entorno de staging. |
| Alcance | Registro, verificación de correo, login, sesiones, TOTP, recuperación, RBAC y auditoría de F1. El proyecto es académico y no mueve dinero real. |

## Decisiones de diseño

### Arquitectura y límites de confianza

1. El navegador se comunica con Next.js mediante rutas del mismo origen. Los Route Handlers de Next.js funcionan como BFF/proxy hacia NestJS y reenvían cookies de sesión sin exponer secretos al código cliente. Esto evita depender de cookies de terceros entre los dominios de Vercel y Render. La conexión BFF→NestJS DEBE usar HTTPS y verificar la cadena, vigencia y nombre del certificado TLS; no se permite degradación a HTTP ni desactivar la verificación. NestJS vuelve a validar cada sesión y permiso; el BFF no sustituye autorización. Esta elección se apoya en la guía de [Next.js Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) y es una inferencia para el despliegue de PLAN.md.
2. Las llamadas del navegador a operaciones de negocio pasan por el BFF. El BFF aplica lista permitida de rutas, valida `Origin` y protección CSRF para solicitudes mutables, y elimina encabezados de identidad suministrados por el cliente. El API NestJS no confía en identificadores de usuario o roles enviados en encabezados.
3. Todo endpoint NestJS se clasifica explícitamente como público, autenticado o autenticado con permiso. Un guard global deniega por defecto; metadatos/decoradores declarativos expresan excepciones públicas y permisos requeridos. Guardas/servicios de autorización consultan el estado vigente de sesión y roles en backend, de acuerdo con la guía de [NestJS Guards y Authorization](https://docs.nestjs.com/security/authorization).
4. Las cookies de acceso y refresh son `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` y host-only (sin `Domain`). HTTPS es obligatorio en producción y staging para navegador→BFF y BFF→API; HSTS se configura en los bordes web/API. Para mutaciones con cookie, el BFF exige `Origin` permitido y token CSRF asociado a la sesión; el API solo acepta el origen/proxy previsto.

### Contraseñas y prevención de abuso

1. `PasswordService` valida longitud de SPEC-002 y delega el hash/verificado a Argon2id. La forma PHC almacena algoritmo, salt y parámetros con el hash; no se persiste ni registra el valor original. Se parte de los mínimos publicados en OWASP Password Storage Cheat Sheet para Argon2id (19 MiB, 2 iteraciones, paralelismo 1) y se calibra en staging para no degradar el servicio; cualquier ajuste respeta seguridad y se registra en la configuración del backend.
2. `PasswordBlocklistService` se ejecuta únicamente en NestJS, tanto en registro como en restablecimiento:
   - Diccionarios locales de `@zxcvbn-ts/core`, `@zxcvbn-ts/language-common`, `@zxcvbn-ts/language-en` y `@zxcvbn-ts/language-es-es` se empaquetan con el API. Se rechaza una coincidencia exacta de la contraseña completa con una contraseña común, o una puntuación zxcvbn de 0, 1 o 2 sobre 4; se acepta puntuación 3 o 4 si no hay otra regla de rechazo. No se rechaza una contraseña únicamente porque contenga una palabra común como parte de una frase.
   - Para contraseñas comprometidas se consulta Pwned Passwords de HIBP con el hash SHA-1 calculado localmente: se envían solo los primeros cinco caracteres hexadecimales del hash, con `Add-Padding: true`; el API compara localmente el sufijo de la contraseña completa y rechaza cuando el conteo de esa coincidencia exacta es mayor que cero. Nunca se envía la contraseña en texto plano ni el hash completo. El SHA-1 se usa solo para este protocolo, nunca para almacenar contraseñas. Fuentes: [HIBP Pwned Passwords API](https://haveibeenpwned.com/API/v3) y [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn); NIST requiere comparar la contraseña completa con una lista de valores comunes, esperados o comprometidos ([SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).
   - Cada intento HIBP tiene timeout total de 3 segundos; se permite como máximo un reintento (dos solicitudes como máximo) únicamente ante timeout, fallo de conexión o respuesta 5xx. No se reintentan respuestas 4xx ni payloads inválidos. Si ambos intentos fallan, o la respuesta es inválida, el registro/restablecimiento se rechaza sin crear la cuenta o cambiar la contraseña y devuelve error genérico reintentable. No se registra contraseña, hash completo, prefijo consultado ni respuesta del proveedor. Los sufijos no coincidentes se descartan inmediatamente y no se guardan en Redis ni PostgreSQL.
3. Redis aplica ventanas móviles y bloqueos con operaciones atómicas Lua o primitivas equivalentes: 5 errores de contraseña/cuenta en 15 min bloquean login 15 min; 20 intentos/IP en 15 min rechazan el resto de esa ventana; 5 errores TOTP/cuenta en 15 min bloquean verificaciones TOTP 15 min. Contadores de contraseña y TOTP son independientes; un TOTP erróneo cuenta también para el límite IP. El fin del bloqueo y una verificación TOTP exitosa reinician el contador TOTP; el éxito de login y fin del bloqueo reinician el contador de contraseña. Redis indisponible provoca rechazo del flujo de autenticación que no pueda aplicar el límite, nunca bypass.
   - El reenvío de verificación usa límites separados: máximo 3 solicitudes por correo normalizado y 10 por IP en una ventana móvil de 60 minutos. Los intentos se cuentan antes de consultar si la cuenta existe, y un exceso conserva la misma respuesta genérica sin enviar correo; Redis indisponible impide el envío.
4. CAPTCHA y correo se encapsulan tras puertos de integración del módulo Auth. El proveedor se configura en el backend y sus secretos no llegan al cliente; la elección del proveedor concreto se conserva para el refinamiento de implementación. Fallos de validación/envío siguen los resultados funcionales de FR-005/006/009.

### Sesiones, JWT y cookies

- `AuthSession` en PostgreSQL representa una sesión/dispositivo y tiene estado revocado/activo, usuario, fechas, motivo de revocación, identificador de familia y metadatos mínimos de auditoría. Cada refresh token es un secreto aleatorio opaco; solo se persiste su digest HMAC-SHA-256, `jti`, expiración, estado, `replacedBy` y familia.
- El API emite JWT de acceso de 15 minutos firmado con clave asimétrica RS256 administrada como secreto de backend y con `kid` para rotación; claims mínimos: `sub`, `sid`, `jti`, `iat`, `exp`, `iss`, `aud`. Los roles no son autoridad dentro del JWT: se consultan en PostgreSQL junto con sesión activa al autorizar. El formato permite que F7 valide la firma con clave pública; el mecanismo de distribución y contrato de validación se definirán en F7, sin crear un endpoint JWKS en F1.
- Refresh token dura 7 días y rota en cada renovación en una transacción: comprobar sesión/token, marcar el token anterior consumido, insertar el siguiente y auditar. Un replay detectado revoca la familia/sesión completa según FR-011. Cerrar sesión revoca solo el `sid` actual. Cambio/restablecimiento de contraseña, recuperación/restablecimiento TOTP, cambio de rol y revocación administrativa invalidan todas las sesiones de la cuenta.
- Cualquier endpoint protegido rechaza JWT vencido, sesión revocada, usuario no habilitado, rol desactualizado o permiso no configurado. La revocación se consulta en cada request protegido; no se usa una caché de roles que retrase su efecto.
- El flujo con segundo factor usa un desafío preautenticado de un solo uso, con vigencia máxima de 5 minutos y sin permisos de negocio. Redis lo consume atómicamente tras una verificación TOTP correcta y lo invalida al completar la autenticación; desafíos vencidos o reutilizados se rechazan y no crean sesión ni emiten cookies normales.

### TOTP y recuperación

- El API genera secretos TOTP compatibles con RFC 6238, con pasos de 30 s y la ventana actual ±1 ya fijada en FR-036. El secreto se cifra en reposo con AES-256-GCM; la clave/versionado vive en variables de entorno del backend, nunca en la base de datos sin cifrar ni en `apps/web`.
- En activación se muestra el secreto/provisioning URI solo al usuario autenticado, y el factor queda activo tras confirmar un código válido. Se generan códigos de recuperación aleatorios de un solo uso; solo se guardan digests, y su consumo es atómico.
- `lastAcceptedTotpStep` se actualiza de forma atómica por usuario. Un código solo se acepta si su timestep coincide con la ventana permitida y es posterior al último timestep aceptado; transacciones/CAS impiden que dos solicitudes concurrentes reutilicen el mismo periodo. Esta decisión cumple FR-037 y [RFC 6238, sección 5.2](https://datatracker.ietf.org/doc/html/rfc6238#section-5.2).
- La recuperación exige el código de recuperación y verificación del correo; al completarse consume el código presentado, invalida el secreto anterior y los demás códigos, revoca sesiones y deja la cuenta en estado `requiere_nuevo_totp`. El login pleno no se emite hasta configurar y confirmar un nuevo autenticador.
- Retiros son F6. F1 entrega una señal de contexto autenticado con TOTP verificado para que F6 aplique 2FA; F6 definirá la vigencia/confirmación fresca requerida para cada retiro, sin construir flujo de retiros en F1.

### RBAC y permisos

- PostgreSQL conserva catálogo de roles/permisos y asignaciones (`Role`, `Permission`, `RolePermission`, `UserRole`). Si una cuenta tiene varios roles, su conjunto de permisos efectivos es la unión de los permisos asociados explícitamente a cada rol asignado.
- Los permisos se declaran por acción de dominio, no solo por nombre de rol. `apostador`, `operador` y `administrador` tienen capacidades generales de SPEC-002; cada módulo posterior debe declarar sus permisos concretos. Administrador incluye capacidades de operador mediante asociaciones explícitas de esos permisos al rol administrador. Un permiso se concede únicamente si está asociado explícitamente a al menos uno de los roles asignados al usuario; si ninguno lo concede, se deniega por defecto y no existe fallback ni concesión implícita.
- Las rutas administrativas requieren permiso administrativo explícito y auditan autorizaciones concedidas/denegadas. El primer administrador se provisiona fuera del registro público por procedimiento controlado; administradores pueden asignar/quitar rol operador. Cambios del rol administrador quedan reservados a provisión controlada.
- Cambio de asignación de rol es transaccional, append-auditado y revoca todas las sesiones afectadas. No hay autoasignación privilegiada ni fallback por roles faltantes.

### Auditoría append-only

- Prisma modela `AuditEvent` con id, actor/tipo (incluido `anonymous` para eventos previos a login), acción, timestamp UTC del servidor, IP, identificador/descripción mínima de dispositivo, objetivo y metadatos permitidos sin secretos. Se aplican minimización y retención de un año conforme a FR-035.
- `apps/api` usa un rol PostgreSQL de runtime con `SELECT`/`INSERT`, sin `UPDATE`, `DELETE`, `TRUNCATE`, DDL ni propiedad de tabla para auditoría. El rol de migraciones/propietario se separa del secreto runtime. Un trigger defensivo rechaza `UPDATE` y `DELETE`; las operaciones normales no pueden alterar eventos. Un proceso de mantenimiento separado aplica borrado de expirados solo después del año de retención, con permisos separados y registro operativo del número eliminado, sin datos de eventos ni credenciales. El límite de garantía frente a superusuario/propietario de base se documenta como control operativo, no como operación normal de aplicación. Fuente primaria: [PostgreSQL privileges](https://www.postgresql.org/docs/current/ddl-priv.html).
- Eventos FR-030/FR-032 se escriben antes de completar la operación protegida o dentro de la misma transacción cuando aplique. Si la persistencia falla, la acción sensible se revierte/deniega según FR-031/AC-017. Ningún secreto, contraseña, token, TOTP o código de recuperación se incluye en auditoría/logs.

## Entidades y persistencia propuestas

| Entidad | Datos principales / reglas |
|---|---|
| `User` | UUID, correo original para presentación, correo normalizado único (trim + comparación case-insensitive conforme FR-003), `passwordHash` PHC Argon2id, `emailVerifiedAt`, declaración de mayoría de edad, estado, timestamps. |
| `Role`, `Permission`, `RolePermission`, `UserRole` | Catálogo controlado de los tres roles y permisos; asignaciones auditadas; sin asignación pública privilegiada. |
| `AuthSession` | Usuario, identificador de sesión/familia, estado, creación/expiración, revocación, razón. |
| `RefreshCredential` | Sesión, digest token, `jti`, vencimiento, consumo/revocación, `replacedBy`; digest único. |
| `EmailActionToken` | Tipo verificación/reset, digest, usuario, emisión/expiración, consumo; único y no reutilizable. Reenvío invalida token previo de verificación. |
| `TotpCredential` | Usuario, secreto cifrado, versión de clave, activo, último timestep aceptado; único por usuario activo. |
| `TotpRecoveryCode` | Usuario, digest, consumido/enabled timestamp; cada código único y de un solo uso. |
| `AuditEvent` | Evento append-only descrito arriba y retención de 1 año. |
| Redis keys | Contadores por cuenta/IP/TOTP con ventana móvil y TTL; desafíos de preautenticación de un solo uso con TTL máximo de 5 minutos. Nunca fuente de roles o saldo. |

Todas las fechas persistidas usan UTC. Las operaciones concurrentes de rotación, uso de token, TOTP anti-replay, recuperación y cambio de rol usan transacciones PostgreSQL/unique constraints o compare-and-set para garantizar una sola aceptación.

## Contratos HTTP previstos

Los nombres siguientes son convenciones de diseño para los handlers; no alteran las rutas públicas/protegidas descritas funcionalmente en SPEC-002. Las rutas concretas pueden ajustarse en tasks manteniendo autorización y semántica:

| Ruta | Acceso | Función |
|---|---|---|
| `POST /auth/register` | Pública + CAPTCHA | Crear cuenta apostador no verificada; correo duplicado con respuesta genérica. |
| `POST /auth/email/verify` | Credencial de verificación | Consumir enlace de un uso y marcar correo verificado. |
| `POST /auth/email/resend` | Pública | Reemitir verificación e invalidar anterior sin revelar existencia; aplicar limitación defensiva para evitar abuso. |
| `POST /auth/login` | Pública + CAPTCHA | Verificar correo/contraseña; rechazar cuentas con correo no verificado sin emitir sesión ni desafío; si TOTP está activo, crear desafío preautenticado. |
| `POST /auth/totp/verify-login` | Desafío de login válido | Verificar TOTP, consumiendo timestep y desafío una sola vez; completar autenticación. Rechazar desafíos vencidos o ya consumidos. |
| `POST /auth/session/refresh` | Cookie refresh | Rotar refresh token; detectar replay y revocar sesión. |
| `POST /auth/logout` | Sesión vigente | Revocar sesión actual. |
| `POST /auth/password/forgot` | Pública | Respuesta genérica; emitir enlace solo para correo verificado asociado. |
| `POST /auth/password/reset` | Token de reset | Aplicar política de contraseña, cambiar hash y revocar todas las sesiones. |
| `POST /auth/totp/setup`, `/confirm` | Sesión autenticada | Configurar/confirmar factor; operación auditada. |
| `POST /auth/totp/recovery` | Código recuperación + verificación correo | Recuperar factor perdido y exigir nuevo enrolamiento. |
| `/auth/admin/*` | Sesión + permiso administrativo | Gestión privilegiada de cuentas/roles, limitada a reglas FR-023/BR-006. |

Cada error de autenticación usa respuestas seguras y genéricas donde lo exige la especificación; las respuestas de validación no contienen token, contraseña, secreto, stack trace ni detalle de existencia de cuenta.

## Estructura prevista

```text
apps/api/src/
├── auth/                 # AuthModule, controladores, servicios, guards y estrategias
├── authorization/        # metadatos/guards de permisos y catálogo RBAC
├── audit/                # escritor, modelos y políticas append-only
├── users/                # identidad y normalización de correo
└── common/                # validación, errores y contexto autenticado compartido

apps/web/app/
├── (auth)/                # registro, login, verificación, recuperación y TOTP
└── api/backend/[...path]/ # BFF Route Handler same-origin hacia apps/api

apps/api/prisma/
├── schema.prisma
└── migrations/            # cambios F1; rol propietario separado del runtime

packages/shared/src/
└── auth-contracts.ts       # tipos públicos no secretos, si se confirma reutilización
```

No se crea `apps/auth`, un microservicio separado ni módulos propios de F2–F7. La carpeta `apps/reports` queda fuera de cambios F1.

## Estrategia de validación

- **Unitarias API**: normalización/unicidad de correo; Argon2; longitud/score zxcvbn y coincidencia exacta de contraseña común; detección HIBP exacta, timeout, un reintento máximo y rechazo cerrado; expiración/consumo de enlaces; políticas RBAC; manejo de errores y exclusión de secretos.
- **Integración API/PostgreSQL/Redis**: registro/verificación; login con correo no verificado denegado; desafío TOTP vencido/reutilizado y consumo único; ventanas y reinicio de contadores; solicitudes concurrentes TOTP; rotación/replay/revocación de refresh; recuperación de contraseña/TOTP; unión RBAC y denegación si ningún rol asignado concede el permiso; política de auditoría y denegación ante fallos de persistencia.
- **Contrato HTTP**: rutas públicas, rutas con credencial específica y rutas protegidas; ausencia de permiso y metadata deben denegar; solo el BFF acepta tráfico de navegador con cookies.
- **E2E web/API**: US1–US6 conforme a la exigencia constitucional de una prueba de integración o E2E por historia; errores, CAPTCHA/correo no disponibles, email no verificado, replay de token, bloqueo, HTTPS y no enumeración.
- **Seguridad**: pruebas de abuso concurrente y fuerza bruta; inspeccionar respuestas/cookies/logs para comprobar que no exponen secretos; verificar que el rol de runtime no puede modificar/borrar/truncar auditoría.
- Los valores de prueba para correos, CAPTCHA y HIBP se simulan con adaptadores; las pruebas no dependen de proveedores externos reales.

## Constitution Check

### Antes de diseño

- [x] **I. Seguridad y antifraude**: RBAC por endpoint, fallo cerrado, mitigaciones de abuso y auditoría de identidad definidos; secretos confinados al backend.
- [x] **II. Integridad financiera**: F1 no toca ledger, saldo ni movimientos; la regla financiera se conserva para las fases que los implementan, sin excepciones.
- [x] **III. Servidor como autoridad**: NestJS valida identidad/sesión/permisos; cliente/BFF no es autoridad y no aporta roles confiables.
- [x] **IV. Pruebas primero**: estrategia incluye integración/E2E por historia y pruebas de abuso; se ejecutarán antes de implementación según los quality gates.
- [x] **V. Tiempo real**: no aplica a F1; no se crea worker ni procesamiento de resultados.
- [x] **VI. Simplicidad**: solo se usan las aplicaciones existentes; BFF vive dentro de `apps/web`, sin nuevo servicio. El BFF se justifica por cookies same-origin con Vercel/Render.
- [x] **VII. UX**: formularios/estados de auth se implementarán mobile-first 360 px y WCAG 2.1 AA conforme constitución.

### Después del diseño

No se identifican violaciones. Riesgos de dependencia externa (correo, CAPTCHA, HIBP) se aíslan tras puertos, fallan cerrados en flujos sensibles y no reciben secretos en claro. El endpoint HIBP recibe solo un prefijo k-anónimo con padding.

## Secuencia técnica recomendada

1. Persistencia Prisma y rol de base runtime/migración; usuario/correo/roles/sesiones/tokens/auditoría.
2. Infraestructura de sesión, clave JWT, cookies BFF/CSRF, guards globales y permisos con denegación por defecto.
3. Registro, normalización, correo verificado, CAPTCHA y bloqueador de contraseña (local + HIBP).
4. Login, contadores Redis, TOTP/anti-replay, recuperación, logout y revocación global.
5. Gestión administrativa de operador, auditoría append-only, UI responsive y pruebas E2E por historia.
6. Integración F6 para retiro con segundo factor y F7 para verificación pública/JWKS se especifica en sus fases; no se implementa en F1.

## Decisiones técnicas tomadas y límites

| Tema | Decisión del plan | Alternativa descartada / motivo |
|---|---|---|
| Consulta de contraseñas | Coincidencia exacta con comunes/comprometidas o score zxcvbn <3/4; HIBP Pwned Passwords range con SHA-1 local, prefijo de 5 caracteres, `Add-Padding`, timeout 3 s, un reintento máximo y fallo cerrado. | Enviar contraseña a un proveedor o depender solo de una lista fija: más exposición o menos cobertura de compromisos conocidos. |
| Tráfico web/API | BFF Route Handlers same-origin en Next; Nest conserva autoridad y revalida todo. | Llamada desde navegador directamente a dominios Vercel/Render: dependencia de cookies cross-site/CORS. |
| Sesiones | PostgreSQL durable; refresh opaco almacenado como digest/familia y rotación transaccional; JWT RS256 de 15 min. | Refresh JWT stateless: dificulta replay/revocación inmediata; HS compartido: F7 tendría que compartir secreto de firma. |
| Límites | Redis con operaciones atómicas; fallo cerrado. | Contadores solo en memoria: inconsistentes entre instancias y reinicios. |
| TOTP | Secreto cifrado; anti-replay atómico con timestep aceptado; códigos de recuperación como digest. | Aceptación sin persistir el timestep permitiría replay/concurrencia. |
| Auditoría | Tabla PostgreSQL append-only para rol runtime; migraciones/retención con rol separado. | Permitir UPDATE/DELETE a la aplicación contradice FR-031 y constitución. |
| Proveedores de correo/CAPTCHA | Adaptadores backend; vendor sigue por seleccionar al implementar y configurar el despliegue. | Acoplar lógica de negocio a un SDK/proveedor antes de comparar soporte, coste y entorno académico. |

## Complejidad justificada

| Complejidad | Motivo | Alternativa sencilla descartada |
|---|---|---|
| BFF en Next.js | Cookie host-only same-origin evita depender de cookies de terceros entre Vercel y Render manteniendo Nest como autoridad. | Acceso browser→API directo introduce CORS y compatibilidad de cookies cross-site. |
| Redis para límites/challenges | Contadores atómicos comunes a instancias y con expiración sin almacenar estado efímero en memoria local. | Contadores locales no son correctos con más de una instancia o reinicio. |
| Consulta HIBP k-anónima | Amplía la lista local con contraseñas comprometidas sin transmitir contraseña ni hash completo. | Solo diccionario local no conoce exposiciones recientes; enviar la contraseña completa es inaceptable. |
