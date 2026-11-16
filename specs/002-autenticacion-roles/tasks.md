# Tasks: Autenticación y roles (SPEC-002)

**Input**: `specs/002-autenticacion-roles/spec.md`, `specs/002-autenticacion-roles/plan.md`
**Fase**: F1 — Identidad y acceso
**Alcance**: autenticación, sesiones, TOTP, RBAC, mitigación de abuso y auditoría. No incluye depósitos, billetera, apuestas, promociones, retiros ni reportes.

> Progreso de implementación: T001–T011 y T015–T019 estaban completadas al iniciar este incremento. Este incremento completa T023–T026, T030–T035, T039–T043, T047–T050, T054–T056 y T059. La migración de hardening de auditoría quedó escrita, pero no fue aplicada. No se crearon ni ejecutaron pruebas y ninguna tarea de pruebas se marca completa. T060 permanece pendiente porque incluye ejecutar pruebas, SonarQube y validar staging.
> Correcciones de auditoría posteriores: registro valida y hashea la contraseña antes de consultar duplicados y conserva respuesta genérica ante fallos de envío; reenvíos limitados a 3 por correo normalizado y 10 por IP por hora; `TRUST_PROXY_HOPS` configurable explícitamente; CSRF firmado y vinculado a la cookie de sesión; la purga registra el conteo eliminado. No se aplicó la migración ni se ejecutaron pruebas.

## Convenciones

- Cada tarea usa el formato obligatorio `- [ ] Tnnn [P?] [USn?] descripción con ruta(s)`. `[P]` indica que puede ejecutarse en paralelo dentro de las dependencias declaradas.
- Las pruebas forman parte del encargo y se escriben antes de la implementación de cada historia; deben fallar antes de implementar el comportamiento.
- Las llamadas a correo, CAPTCHA y HIBP se simulan en pruebas. Las operaciones reales requieren configuración segura del entorno.
- No se almacenan secretos en el frontend, repositorio, logs ni respuestas de error.

## Phase 1: Setup

**Purpose**: preparar dependencias y configuración del módulo dentro del monorepo existente.

- [X] T001 Seleccionar y fijar versiones mantenidas de Prisma, Argon2id, zxcvbn-ts y las bibliotecas compatibles de JWT/TOTP en `apps/api/package.json`; actualizar `pnpm-lock.yaml` sin añadir aplicaciones ni servicios nuevos.
- [X] T002 Definir validación de configuración de auth (PostgreSQL, Redis, claves JWT/TOTP, origen BFF y configuración HIBP) en `apps/api/src/config/env.validation.ts` y documentar solo nombres/valores ficticios en `apps/api/.env.example`.
- [X] T003 Configurar Prisma y sus comandos de esquema/migración en `apps/api/prisma/schema.prisma` y `apps/api/package.json`, respetando PostgreSQL como almacenamiento durable.

## Phase 2: Foundational

**Purpose**: completar la base compartida que bloquea todas las historias.

- [X] T004 Definir en `apps/api/prisma/schema.prisma` los modelos User, Role, Permission, RolePermission, UserRole, AuthSession, RefreshCredential, EmailActionToken, TotpCredential, TotpRecoveryCode y AuditEvent con las relaciones y restricciones descritas en `plan.md`.
- [X] T005 Crear la migración inicial de F1 en `apps/api/prisma/migrations/202611150001_auth_foundation/migration.sql`, incluyendo índices únicos para correo normalizado/tokens y separación de roles de migración, runtime y mantenimiento.
- [X] T006 Configurar validación estricta de DTOs, errores seguros y registro estructurado sin secretos en `apps/api/src/common/validation/validation.pipe.ts`, `apps/api/src/common/errors/auth-error.filter.ts` y `apps/api/src/main.ts`.
- [X] T007 Implementar AuditModule y su escritor tipado en `apps/api/src/audit/audit.module.ts` y `apps/api/src/audit/audit.service.ts`; registrar actor/tipo, acción, fecha/hora UTC, IP y dispositivo sin incluir credenciales o factores.
- [X] T008 Implementar contadores Redis atómicos por cuenta/IP/TOTP con ventanas, bloqueos y reinicios de SPEC-002 en `apps/api/src/auth/abuse/attempt-counter.service.ts`; denegar el flujo protegido si Redis no permite aplicar el límite.
- [X] T009 Definir puertos y adaptadores de correo y CAPTCHA y un cliente HIBP con respuesta validada en `apps/api/src/auth/integrations/email.port.ts`, `apps/api/src/auth/integrations/captcha.port.ts` y `apps/api/src/auth/integrations/hibp.client.ts`; seleccionar el proveedor de correo/CAPTCHA durante esta tarea y guardar solo configuración no secreta en `apps/api/src/config/auth-providers.ts`.
- [X] T010 Crear el contexto autenticado, decorador explícito de rutas públicas y guard global de autenticación en `apps/api/src/auth/auth-context.ts`, `apps/api/src/auth/decorators/public.decorator.ts` y `apps/api/src/auth/guards/authentication.guard.ts`; toda ruta sin marca pública o credencial reconocida queda protegida por defecto.
- [X] T011 Crear el BFF same-origin y la política de cookies/CSRF en `apps/web/app/api/backend/[...path]/route.ts` y `apps/web/src/lib/auth/csrf.ts`; exigir HTTPS y validar certificados TLS en las llamadas BFF→NestJS, sin permitir downgrade ni desactivar la verificación.

**Checkpoint**: modelos, configuración, auditoría, adaptadores, contadores y límites de confianza disponibles antes de las historias.

## Phase 3: US1 — Crear y verificar una cuenta (P1) 🎯 MVP

**Goal**: registrar un apostador con correo normalizado, mayoría de edad declarada y correo verificado.

**Independent Test**: registro válido inicia verificación sin habilitar login; datos inválidos, menoría de edad no declarada, duplicados, CAPTCHA/correo fallidos no crean una cuenta utilizable.

### Tests — US1 (primero)

- [ ] T012 [P] [US1] Escribir pruebas unitarias de normalización case-insensitive, espacios externos, mayoría de edad, duplicados genéricos, coincidencia exacta de contraseña común, score zxcvbn y fail-closed HIBP en `apps/api/test/auth/register.service.spec.ts` y `apps/api/test/auth/password.service.spec.ts`.
- [ ] T013 [P] [US1] Escribir pruebas de integración de registro/verificación para enlace de 24 horas, un solo uso, reenvío que invalida el anterior y fallos de correo/CAPTCHA en `apps/api/test/auth/register.integration.spec.ts`.
- [ ] T014 [P] [US1] Escribir E2E del alta, confirmación de correo y denegación de login mientras no esté verificado en `apps/web/e2e/auth/register.spec.ts`.

### Implementation — US1

- [X] T015 [US1] Implementar repositorio/servicio de usuario que recorte espacios externos, compare correo sin distinguir mayúsculas, asigne rol apostador y requiera declaración afirmativa de mayoría de edad en `apps/api/src/users/users.service.ts`.
- [X] T016 [US1] Implementar PasswordService con Argon2id, longitud de 15–128 caracteres, aceptación de espacios/Unicode, coincidencia exacta de password blocklist, zxcvbn 0–4 rechazando scores <3 y consulta HIBP k-anónima con timeout de 3 s y máximo un reintento en `apps/api/src/auth/password/password.service.ts`.
- [X] T017 [US1] Implementar registro protegido por CAPTCHA, respuesta genérica ante duplicados y envío de verificación sin habilitar cuentas no verificadas en `apps/api/src/auth/register.controller.ts` y `apps/api/src/auth/register.service.ts`.
- [X] T018 [US1] Implementar tokens de verificación de un solo uso con vencimiento de 24 h, reenvío que invalida el anterior, límites móviles de 3 por correo normalizado y 10 por IP cada 60 min, respuesta genérica y eventos de auditoría en `apps/api/src/auth/email-verification.service.ts`, `apps/api/src/auth/abuse/attempt-counter.service.ts` y `apps/api/src/auth/email-verification.controller.ts`.
- [X] T019 [US1] Crear formularios accesibles de registro y verificación de correo, con estados de error seguros y flujo vía BFF, en `apps/web/app/(auth)/register/page.tsx` y `apps/web/app/(auth)/verify-email/page.tsx`.

**Checkpoint**: US1 funciona y se puede validar de forma independiente; el correo solo habilita la cuenta tras verificación.

## Phase 4: US2 — Iniciar y mantener una sesión protegida (P1)

**Goal**: autenticar cuenta verificada, establecer sesión segura, renovar y cerrar sesión.

**Independent Test**: credenciales válidas establecen la sesión; correo no verificado o credenciales/CAPTCHA inválidos no emiten cookies; refresh rota y replay revoca la sesión completa.

### Tests — US2 (primero)

- [ ] T020 [P] [US2] Escribir pruebas unitarias de login, Argon2 verify, cuenta no verificada, bloqueo de contraseña y límite por IP en `apps/api/test/auth/login.service.spec.ts`.
- [ ] T021 [P] [US2] Escribir pruebas de integración para emisión/cookies de JWT 15 min, refresh opaco de 7 días, rotación, replay, revocación y logout en `apps/api/test/auth/session.integration.spec.ts`.
- [ ] T022 [P] [US2] Escribir E2E de login, renovación, cierre de sesión y respuestas sin tokens para credenciales rechazadas en `apps/web/e2e/auth/session.spec.ts`.

### Implementation — US2

- [X] T023 [US2] Implementar login con CAPTCHA, comprobación explícita de `emailVerifiedAt`, validación Argon2 y conexión con contadores de contraseña/IP en `apps/api/src/auth/login.service.ts` y `apps/api/src/auth/login.controller.ts`; cuenta no verificada no recibe sesión ni desafío.
- [X] T024 [US2] Implementar emisión de JWT RS256 de 15 min y refresh opaco de 7 días en cookies seguras, almacenamiento digest/familia y rotación transaccional con detección de replay en `apps/api/src/auth/session.service.ts` y `apps/api/src/auth/token.service.ts`.
- [X] T025 [US2] Implementar logout de sesión actual y servicio idempotente `revokeAll` para cambios de contraseña, TOTP, rol y revocación administrativa en `apps/api/src/auth/session-revocation.service.ts` y `apps/api/src/auth/session.controller.ts`.
- [X] T026 [US2] Implementar vistas de login y cierre de sesión que usen exclusivamente rutas BFF y no almacenen tokens en JavaScript/localStorage en `apps/web/app/(auth)/login/page.tsx` y `apps/web/src/lib/auth/session.ts`.

**Checkpoint**: login y sesión cumplen expiraciones, rotación, replay y revocaciones especificadas.

## Phase 5: US3 — Configurar y usar segundo factor (P1)

**Goal**: configurar TOTP, exigirlo en login y recuperar acceso ante pérdida del autenticador.

**Independent Test**: TOTP solo se activa tras confirmación; cada login activo requiere TOTP; timestep y desafío no se reutilizan; recuperación consume códigos, invalida factor/sesiones y exige re-enrolamiento.

### Tests — US3 (primero)

- [ ] T027 [P] [US3] Escribir pruebas unitarias RFC 6238 para pasos de 30 s, ventana ±1, anti-replay por timestep, contador TOTP y recuperación de códigos en `apps/api/test/auth/totp.service.spec.ts`.
- [ ] T028 [P] [US3] Escribir pruebas de integración para activación confirmada, desafío de 5 min uso único, rechazo vencido/reutilizado y reset TOTP en `apps/api/test/auth/totp-login.integration.spec.ts`.
- [ ] T029 [P] [US3] Escribir integración/E2E de recuperación con código no usado + correo verificado, invalidación del secreto/códigos restantes, revocación global y bloqueo hasta nuevo enrolamiento en `apps/api/test/auth/totp-recovery.integration.spec.ts` y `apps/web/e2e/auth/totp.spec.ts`.

### Implementation — US3

- [X] T030 [US3] Implementar cifrado AES-256-GCM del secreto TOTP, setup y activación solo tras código válido, códigos de recuperación como digest y consumo atómico en `apps/api/src/auth/totp/totp.service.ts` y `apps/api/src/auth/totp/totp-crypto.service.ts`.
- [X] T031 [US3] Implementar el almacén Redis del desafío preautenticado con TTL máximo 5 min, generación no predecible, consumo atómico de un solo uso y rechazo de expirados/reutilizados en `apps/api/src/auth/totp/pre-auth-challenge.service.ts`.
- [X] T032 [US3] Implementar validación TOTP en cada login integrando el desafío, anti-replay atómico de `lastAcceptedTotpStep`, bloqueo 5 fallos/15 min por 15 min y reset al terminar el bloqueo o validar correctamente en `apps/api/src/auth/totp/totp.service.ts`; solo completar autenticación después de consumir ambos.
- [X] T033 [US3] Implementar recuperación que exija código no usado y verificación de correo, consuma el código, invalide el secreto y códigos restantes, revoque sesiones y exija nuevo TOTP confirmado antes del login pleno en `apps/api/src/auth/totp/totp-recovery.service.ts` y `apps/api/src/auth/totp/totp-recovery.controller.ts`.
- [X] T034 [US3] Exponer en el contexto de autenticación del backend la señal de que TOTP fue satisfecho para integración posterior de F6, sin crear endpoints ni flujo de retiro en `apps/api/src/auth/auth-context.ts`.
- [X] T035 [US3] Crear pantallas accesibles de setup, confirmación y recuperación TOTP que no persistan secretos en cliente y consuman solo el BFF en `apps/web/app/(auth)/totp/setup/page.tsx` y `apps/web/app/(auth)/totp/recovery/page.tsx`.

**Checkpoint**: flujos TOTP pueden probarse sin implementar retiros de F6.

## Phase 6: US4 — Acceder solo a las funciones autorizadas (P1)

**Goal**: aplicar RBAC por endpoint, unión explícita de permisos y control administrativo.

**Independent Test**: cada endpoint protegido deniega sin sesión/permisos; los permisos de roles múltiples son unión; apostador/operador no acceden a acciones administrativas y no hay autoasignación privilegiada.

### Tests — US4 (primero)

- [ ] T036 [P] [US4] Escribir pruebas unitarias de unión de permisos por roles, falta de asociación explícita y denegación por defecto en `apps/api/test/authorization/permission-policy.spec.ts`.
- [ ] T037 [P] [US4] Escribir pruebas de integración de asignación/retiro de operador, revocación administrativa por seguridad, cambios de rol y revocación de sesiones con auditoría en `apps/api/test/authorization/roles.integration.spec.ts`.
- [ ] T038 [P] [US4] Escribir E2E de denegación por rol insuficiente y rutas administrativas solo para permiso admin en `apps/web/e2e/auth/authorization.spec.ts`.

### Implementation — US4

- [X] T039 [US4] Implementar catálogo y seed idempotente de roles/permisos, con asociación explícita de capacidades de operador al administrador y unión de permisos asignados en `apps/api/src/authorization/permissions.seed.ts` y `apps/api/src/authorization/permission-policy.service.ts`.
- [X] T040 [US4] Implementar decoradores de permisos y guard de autorización global que falle cerrado si falta metadata, rol o permiso en `apps/api/src/authorization/decorators/require-permissions.decorator.ts` y `apps/api/src/authorization/guards/authorization.guard.ts`.
- [X] T041 [US4] Implementar endpoints administrativos mínimos de asignación/retiro del rol operador y revocación de sesiones por seguridad, con autorización explícita, auditoría transaccional y revocación global al cambiar rol en `apps/api/src/authorization/roles.controller.ts`, `apps/api/src/authorization/roles.service.ts` y `apps/api/src/auth/admin-sessions.controller.ts`.
- [X] T042 [US4] Implementar mecanismo controlado y auditado fuera del registro público para provisionar el primer administrador y restringir cambios de rol administrador en `apps/api/src/authorization/admin-provision.command.ts`.
- [X] T043 [US4] Crear UI administrativa limitada a la gestión de rol operador, sin CRUD de negocio de otras fases, en `apps/web/app/(admin)/users/roles/page.tsx`.

**Checkpoint**: la aplicación de permisos es verificable por endpoint; no se habilitan módulos de operación, apuestas o reportes.

## Phase 7: US5 — Proteger la cuenta frente a abuso y dejar trazabilidad (P1)

**Goal**: verificar los límites antiabuso y completar auditoría append-only para eventos de autenticación/autorización.

**Independent Test**: se cumplen umbrales/reset separados de contraseña, TOTP e IP; los eventos de los flujos integrados se guardan con actor/acción/tiempo/IP/dispositivo; si falla auditoría sensible, no se completa la acción; la aplicación no altera eventos previos. US6 verifica además el evento de restablecimiento de contraseña.

### Tests — US5 (primero)

- [ ] T044 [P] [US5] Escribir pruebas de integración concurrentes para 5 fallos de contraseña/cuenta, 20 intentos/IP y 5 fallos TOTP, bloqueos y reinicios independientes en `apps/api/test/auth/abuse-limits.integration.spec.ts`.
- [ ] T045 [P] [US5] Escribir pruebas de seguridad PostgreSQL que demuestren que el rol runtime no puede UPDATE/DELETE/TRUNCATE y que el rol de mantenimiento elimina solo eventos con más de un año en `apps/api/test/audit/audit-permissions.integration.spec.ts`.
- [ ] T046 [P] [US5] Escribir pruebas de fallo cerrado de CAPTCHA, Redis y persistencia de auditoría, comprobando ausencia de sesión/acción completada y de filtración de secretos en `apps/api/test/auth/security-failures.spec.ts`.

### Implementation — US5

- [X] T047 [US5] Integrar eventos FR-030/FR-032 en registro, login, errores de autenticación, cambios de factor, sesiones, denegaciones y cambios administrativos, con campos requeridos y sin secretos, en los servicios `apps/api/src/auth/` y `apps/api/src/authorization/` usando `apps/api/src/audit/audit.service.ts`.
- [X] T048 [US5] Asegurar que operaciones sensibles reviertan o se denieguen cuando no puedan persistir auditoría, sin devolver éxito parcial, en `apps/api/src/audit/audit.service.ts` y servicios transaccionales de `apps/api/src/auth/`.
- [X] T049 [US5] Configurar privilegios append-only, trigger de protección y política de retención anual con rol de mantenimiento separado en `apps/api/prisma/migrations/202611150002_audit_hardening/migration.sql` y `apps/api/src/audit/audit-retention.service.ts`.
- [X] T050 [US5] Unificar el mapeo de errores de autenticación/autorización para no revelar credenciales, tokens, secretos, existencia de cuenta ni detalles internos en `apps/api/src/auth/auth-error.mapper.ts` y `apps/api/src/common/errors/auth-error.filter.ts`.

**Checkpoint**: pruebas verifican controles completos contra fuerza bruta y la inmutabilidad de auditoría mediante operaciones normales.

## Phase 8: US6 — Recuperar una contraseña olvidada (P1)

**Goal**: restablecer contraseña sin enumerar cuentas, manteniendo TOTP y revocando sesiones.

**Independent Test**: correos registrados/no registrados obtienen la misma respuesta pública; enlace al correo verificado es de un uso/30 min; contraseña cumple policy; al completar cambio se revocan sesiones y TOTP sigue activo.

### Tests — US6 (primero)

- [ ] T051 [P] [US6] Escribir pruebas unitarias de respuesta genérica, token expirado/reutilizado y validación de nueva contraseña en `apps/api/test/auth/password-recovery.service.spec.ts`.
- [ ] T052 [P] [US6] Escribir pruebas de integración para correo registrado/no registrado, enlace de 30 min/un solo uso, auditoría/fallo cerrado, revocación global de sesiones y preservación de TOTP en `apps/api/test/auth/password-recovery.integration.spec.ts`.
- [ ] T053 [P] [US6] Escribir E2E de solicitud genérica y restablecimiento completo por correo verificado en `apps/web/e2e/auth/password-recovery.spec.ts`.

### Implementation — US6

- [X] T054 [US6] Implementar solicitud pública genérica y emisión de token de reset opaco de un solo uso, digestado y válido 30 min, enviándolo solo al correo verificado de la cuenta en `apps/api/src/auth/password-recovery.service.ts` y `apps/api/src/auth/password-recovery.controller.ts`.
- [X] T055 [US6] Implementar consumo atómico del enlace, reutilizar PasswordService/Argon2id/blocklist, cambiar la contraseña, registrar el evento de auditoría, revocar todas las sesiones y conservar TOTP activo en `apps/api/src/auth/password-recovery.service.ts`.
- [X] T056 [US6] Crear formularios accesibles de solicitud y establecimiento de nueva contraseña mediante BFF, mostrando respuesta genérica sin enumeración de cuenta en `apps/web/app/(auth)/password/forgot/page.tsx` y `apps/web/app/(auth)/password/reset/page.tsx`.

**Checkpoint**: la recuperación es independiente del flujo TOTP y no revela existencia de cuenta.

## Phase 9: Polish y validación transversal

**Purpose**: comprobar integración F1 completa, privacidad, accesibilidad y quality gates.

- [ ] T057 [P] Añadir una matriz de pruebas de autorización por cada endpoint F1, incluyendo rutas públicas/credenciales específicas y denegación por defecto, en `apps/api/test/authorization/endpoints.matrix.spec.ts`.
- [ ] T058 [P] Añadir pruebas E2E de HTTPS/cookies BFF, CSRF, verificación TLS BFF→NestJS, auditoría sin secretos y recorridos US1–US6 en `apps/web/e2e/auth/security-regression.spec.ts`.
- [X] T059 Revisar responsive 360 px y WCAG 2.1 AA en pantallas auth/admin y ajustar accesibilidad en `apps/web/app/(auth)/` y `apps/web/app/(admin)/`.
- [ ] T060 Ejecutar lint, typecheck, pruebas API/web/E2E y quality gate SonarQube; corregir fallos en los archivos F1 afectados y verificar despliegue de staging conforme a `package.json`, `apps/api/package.json` y `apps/web/package.json`.

## Dependencies & Execution Order

### Dependencias de fases

- **Setup (Phase 1)**: T001 → T002/T003; ninguna historia puede comenzar hasta fijar dependencias/configuración y Prisma.
- **Foundational (Phase 2)**: T004 depende de T003; T005/T007 requieren T004; T008/T009/T010/T011 pueden avanzar en paralelo tras T002, pero todas deben completarse antes de las historias.
- **US1 (Phase 3)**: depende de toda la base; establece usuario y correo verificado.
- **US2 (Phase 4)**: depende de US1 (cuentas verificadas) y de contadores/integraciones de base.
- **US3 (Phase 5)**: depende de US2 para sesiones; incluye desafío TOTP y recuperación.
- **US4 (Phase 6)**: depende de US1/US2 para usuario autenticado y asignación apostador; puede paralelizarse con US3 una vez que US2 finalice si los archivos se mantienen separados.
- **US5 (Phase 7)**: valida e integra los eventos/controles de US1–US4; necesita sus flujos para completar cobertura de auditoría.
- **US6 (Phase 8)**: depende de US1 (correo verificado), US2 (`revokeAll`) y US5 (escritor/auditoría fail-closed); completa la auditoría del restablecimiento de contraseña.
- **Polish (Phase 9)**: depende de US1–US6 terminadas.

### Dependencias entre historias

```text
Setup → Foundational → US1 → US2 → (US3 ∥ US4) → US5 → US6 → Polish
```

US3 y US4 pueden ejecutarse en paralelo después de US2 si se asignan personas distintas y se respetan las rutas separadas. US5 requiere que los eventos de las historias anteriores estén integrados; US6 espera US5 para reutilizar el camino fail-closed de auditoría.

### Paralelización concreta

- En Setup, T002 puede prepararse en paralelo a la selección de dependencias T001 si no modifica `package.json`; T003 espera T001.
- En Foundational, T008, T009, T010 y T011 trabajan archivos distintos y pueden paralelizarse después de T002; T007 espera el modelo/migración T004–T005.
- En cada historia, las pruebas unitarias, integración y E2E con etiqueta `[P]` pueden escribirse en paralelo en sus archivos de test separados; deben ejecutarse como rojas antes de implementación.
- Tras US2: US3 y US4 son candidatos a paralelo; US6 espera US5. No paralelizar cambios sobre `apps/api/src/auth/auth-context.ts`, `session-revocation.service.ts` ni `apps/api/prisma/schema.prisma`.

## Implementation Strategy

### MVP

El MVP es **US1**: registro y verificación de correo. Requiere Phase 1, Phase 2 y las tareas US1; no debe marcarse utilizable ni permitir login hasta que el correo esté verificado.

### Entrega incremental

1. Setup + Foundational.
2. US1 registro/verificación y validación independiente.
3. US2 login/sesiones, seguido de US3 TOTP y US4 RBAC en paralelo cuando sea posible.
4. US5 auditoría/abuso transversal después de integrar US1–US4.
5. US6 recuperación de contraseña después de disponer del camino fail-closed de auditoría; terminar con Phase 9.

Cada historia se valida de forma independiente con las pruebas listadas. Los módulos de F2–F7 solo consumen las señales de auth/RBAC previstas en sus fases; no se implementan como parte de estas tareas.
