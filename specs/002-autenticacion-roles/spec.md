# Especificación funcional: Autenticación y roles

**Feature Branch**: `feature/spec-2-autenticacion-roles`
**Fase**: F1 — Identidad y acceso
**Estado**: Borrador funcional
**Fuente**: Fase F1 de [`PLAN.md`](../../PLAN.md), [Constitución](../../.specify/memory/constitution.md) y requisitos del proyecto en [`promtp.md`](../../promtp.md).

## Descripción del problema

La plataforma necesita identificar a sus usuarios y controlar qué operaciones pueden realizar. Sin registro verificado, autenticación segura, protección contra abuso y autorización por rol, las funciones de identidad y las funciones sensibles de fases posteriores quedarían expuestas a suplantación y acceso indebido. La plataforma es un proyecto académico y no opera con dinero real.

## Clarifications

### Session 2026-11-15

- Q: ¿Qué nivel de permisos quieres dejar definido en SPEC-002 para los roles apostador, operador y administrador? → A: Definir las capacidades generales conocidas de los tres roles en SPEC-002; cada especificación de dominio detalla los permisos de sus propias operaciones.
- Q: ¿Qué operaciones deben poder iniciarse sin una sesión autenticada? → A: Registro, login, verificación de correo e inicio de recuperación son públicos. Renovar sesión y completar verificaciones requiere su credencial correspondiente; el resto de rutas protegidas.
- Q: ¿Qué mecanismo debe permitir recuperar una cuenta cuando la persona pierde acceso a su autenticador TOTP? → A: Códigos de recuperación de un solo uso y verificación del correo registrado.
- Q: ¿Cuándo debe exigirse TOTP a una cuenta que ya lo activó? → A: TOTP en cada inicio de sesión de cuentas que lo activaron y antes de los retiros.
- Q: ¿Qué política debe aplicarse a la duración, rotación y revocación de sesiones? → A: JWT 15 min, refresh 7 días; rotar en cada uso; reutilización revoca la sesión completa; cerrar sesión revoca la actual y una acción de seguridad puede revocar todas.
- Q: ¿Cómo debe actuar el sistema si no puede validar CAPTCHA, enviar o verificar correo, o guardar un evento de auditoría? → A: Denegar el flujo afectado: CAPTCHA inválido/no disponible impide registro o login; fallo de correo impide verificar; fallo de auditoría impide completar acciones sensibles.
- Q: ¿Qué límites de intentos fallidos de inicio de sesión quieres aplicar por cuenta y por IP, y cuánto debe durar el bloqueo? → A: 5 fallos por cuenta/15 min → bloqueo de 15 min; máximo 20 intentos por IP/15 min.
- Q: ¿Quién debe poder asignar o retirar los roles de operador y administrador? → A: Primer administrador provisionado de forma controlada; administradores pueden asignar o retirar roles de operador. Los cambios del rol administrador requieren provisión controlada y auditoría.
- Q: ¿Cómo debe recuperar su contraseña una persona que la olvidó? → A: Enlace de un solo uso al correo verificado, vence en 30 min; al cambiar la contraseña se revocan las sesiones y TOTP permanece activo.
- Q: ¿Qué política quieres aplicar para normalizar correos, responder a intentos de registro duplicado y gestionar la verificación por correo? → A: Quitar espacios externos y comparar sin distinguir mayúsculas; respuesta genérica ante duplicados; enlace único de verificación válido 24 h; reenviar invalida el enlace anterior.
- Q: ¿Qué eventos de seguridad deben guardarse en auditoría y durante cuánto tiempo deben conservarse? → A: Registrar éxitos y fallos de autenticación, cambios de credenciales/factores, ciclo de vida de sesiones, denegaciones y cambios administrativos, con actor, acción, fecha/hora, IP y dispositivo; retenerlos 1 año; append-only.
- Q: ¿Qué ventana temporal debe aceptar el sistema para validar un código TOTP? → A: Periodos de 30 segundos; aceptar el actual y un periodo adyacente antes o después.
- Q: ¿Cómo debe impedirse que un código TOTP ya aceptado se vuelva a usar? → A: Aceptar una sola vez cada periodo TOTP por cuenta; rechazar usos posteriores del mismo periodo en cualquier flujo.
- Q: ¿Cuántos códigos TOTP incorrectos deben permitirse antes de bloquear temporalmente nuevas verificaciones? → A: 5 códigos incorrectos por cuenta en 15 min → bloquear verificaciones TOTP durante 15 min; registrar el evento y mantener TOTP activo.
- Q: ¿Qué cambios o incidentes deben revocar todas las sesiones activas de una cuenta? → A: Revocar todas tras cambio/restablecimiento de contraseña, recuperación/restablecimiento de TOTP, cambio de rol o revocación administrativa por seguridad; auditar cada evento.
- Q: ¿Cuándo deben reiniciarse los contadores de intentos fallidos por cuenta y por IP? → A: Cuenta: reiniciar tras login exitoso o al terminar el bloqueo de 15 min. IP: ventana móvil; cada intento deja de contar tras 15 min.
- Q: Después de comprobar el código de recuperación y el correo, ¿qué debe ocurrir con el autenticador TOTP perdido y con el acceso a la cuenta? → A: Consumir el código usado, invalidar el autenticador perdido y los códigos restantes, revocar todas las sesiones y exigir configurar y confirmar un nuevo TOTP antes del login pleno.
- Q: ¿Debe permitirse iniciar sesión antes de verificar el correo electrónico? → A: No permitir iniciar sesión hasta verificar el correo; solo se permiten las rutas públicas de verificación y recuperación.
- Q: ¿Qué longitud y reglas mínimas debe cumplir una contraseña nueva o restablecida? → A: Entre 15 y 128 caracteres; aceptar espacios y Unicode; no exigir reglas de composición; rechazar contraseñas comunes o comprometidas.
- Q: ¿Cómo debe responder el inicio público de recuperación de contraseña para evitar enumerar cuentas? → A: Devolver la misma respuesta genérica tanto si el correo corresponde a una cuenta como si no; enviar el enlace únicamente al correo verificado asociado a una cuenta.
- Q: ¿Cómo se relacionan los contadores de contraseña, TOTP e IP durante el login? → A: Mantener independientes el contador por contraseña y el contador por códigos TOTP; un TOTP incorrecto no incrementa el contador de contraseña, pero el intento de login sí cuenta para el límite por IP.
- Q: ¿Cuándo se reinicia el contador de fallos TOTP? → A: Se reinicia al finalizar el bloqueo de 15 minutos y tras una verificación TOTP exitosa; los fallos TOTP no incrementan el contador de contraseñas.

## Objetivos

- Permitir que un apostador cree una cuenta con correo verificado y declaración de mayoría de edad.
- Proteger el acceso con contraseña almacenada mediante Argon2, JWT de corta duración en cookie httpOnly y refresh token rotativo.
- Ofrecer TOTP y exigir segundo factor para los retiros que se incorporen en F6.
- Aplicar RBAC con denegación por defecto en cada endpoint y proteger las operaciones administrativas.
- Mitigar automatización y fuerza bruta mediante límites, bloqueo y CAPTCHA en registro e inicio de sesión.
- Mantener un historial append-only de eventos relevantes de autenticación, autorización y seguridad.

## Alcance

Incluye registro y verificación por correo, declaración de mayoría de edad, inicio y cierre de sesión, renovación y revocación de sesiones/tokens, configuración y uso de TOTP, recuperación de acceso tras pérdida del autenticador mediante FR-019, restablecimiento de contraseña olvidada mediante FR-034, roles apostador/operador/administrador, autorización por rol, controles contra fuerza bruta y auditoría de seguridad.

## Exclusiones

- Funciones de billetera, depósitos, apuestas, promociones y procesamiento de retiros, que pertenecen a otras especificaciones/fases. Esta especificación establece únicamente que el retiro requerirá 2FA.
- Gestión de partidos, mercados, cuotas, aplazamientos y cupones por operador (F3/F6); se limita a definir los roles y la autorización que deberán aplicar esos módulos.
- Aprobación de retiros, reglas de fraude de negocio, reportes y dashboard (F6/F7).
- Verificación de identidad documental o KYC: los documentos consultados solo exigen correo verificado y declaración de mayoría de edad; no definen validación documental.
- Proveedor de correo, proveedor de CAPTCHA, interfaz visual concreta, endpoints, esquema de base de datos y estrategia de despliegue. Son decisiones de diseño/planificación.

## Actores y tipos de usuario

| Actor/rol | Descripción y capacidades conocidas |
|---|---|
| Visitante | Persona sin sesión que puede iniciar registro, login, verificación de correo e inicio de recuperación. Renovar sesión y completar verificaciones requiere la credencial correspondiente; las demás rutas protegidas requieren autenticación y autorización. |
| Apostador | Usuario registrado. Puede registrarse, verificar su correo, depositar, apostar, consultar historial, retirar ganancias y usar cupones conforme a sus especificaciones. |
| Operador | Usuario autorizado para gestionar partidos, mercados, cuotas, aplazamientos/suspensiones y promociones/cupones conforme a sus especificaciones. |
| Administrador | Puede realizar las capacidades del operador y, además, gestionar usuarios y roles, aprobar retiros sospechosos y acceder a reportes/auditoría según las especificaciones correspondientes. |
| Servicio de aplicación | Backend NestJS que autentica, autoriza y registra eventos; es autoridad para decisiones de acceso. |
| Servicio externo de correo/CAPTCHA | Dependencias externas necesarias para verificar correo y presentar/validar CAPTCHA. El proveedor queda pendiente para la planificación técnica; el comportamiento funcional ante fallos está definido en FR-005, FR-006 y FR-009. |

## Historias de usuario

### US1 — Crear y verificar una cuenta (Prioridad P1)

Como visitante, quiero registrarme con mi correo, contraseña y declaración de mayoría de edad y verificar el correo, para obtener una cuenta de apostador.

**Criterio independiente**: un correo nuevo con datos válidos y declaración afirmativa inicia el proceso de verificación; la cuenta no se considera con correo verificado hasta completar esa verificación. Datos inválidos, duplicados o declaración negativa no producen una cuenta utilizable.

### US2 — Iniciar y mantener una sesión protegida (Prioridad P1)

Como usuario registrado, quiero autenticarme con correo y contraseña y mantener una sesión renovable, para acceder a las funciones permitidas para mi rol.

**Criterio independiente**: credenciales válidas permiten establecer una sesión protegida; credenciales inválidas no la establecen; la renovación rota el refresh token y el cierre/revocación impide renovar la sesión revocada.

### US3 — Configurar y usar segundo factor (Prioridad P1)

Como usuario, quiero activar TOTP y usarlo como segundo factor, para añadir protección a mi cuenta y cumplir el requisito de 2FA para retiros.

**Criterio independiente**: TOTP no queda activo sin confirmar su configuración; las cuentas que lo activan deben validarlo en cada login, los retiros requieren 2FA válido y recuperar el acceso tras perder el autenticador invalida el factor anterior y exige activar uno nuevo antes del login pleno.

### US4 — Acceder solo a las funciones autorizadas (Prioridad P1)

Como usuario con un rol asignado, quiero que cada operación compruebe mis permisos, para que mi cuenta no pueda ejecutar acciones reservadas a otros roles.

**Criterio independiente**: por cada ruta protegida, una solicitud no autenticada, sin permiso o con rol insuficiente es denegada; las operaciones administrativas no están disponibles para apostadores ni operadores salvo autorización documentada.

### US5 — Proteger la cuenta frente a abuso y dejar trazabilidad (Prioridad P1)

Como responsable del sistema, quiero limitar intentos abusivos y conservar eventos de seguridad en auditoría append-only, para reducir fuerza bruta y poder revisar acciones relevantes.

**Criterio independiente**: los controles de limitación/bloqueo y CAPTCHA se aplican a registro e inicio de sesión; los eventos de autenticación/autorización definidos se registran y las operaciones normales de la aplicación no pueden alterar ni eliminar eventos anteriores.

### US6 — Recuperar una contraseña olvidada (Prioridad P1)

Como usuario que no puede acceder a su cuenta, quiero solicitar un restablecimiento de contraseña mediante mi correo verificado, para recuperar el acceso sin revelar a terceros si tengo una cuenta.

**Criterio independiente**: la solicitud devuelve la misma respuesta genérica para correos registrados y no registrados; si el correo verificado pertenece a una cuenta, se envía un enlace de un solo uso sujeto a FR-034.

## Requisitos funcionales

### Registro y verificación

- **FR-001**: El sistema DEBE permitir el registro de una cuenta mediante correo electrónico y contraseña.
- **FR-002**: El sistema DEBE validar los datos de registro y restablecimiento de contraseña antes de aplicarlos. Las contraseñas DEBEN tener entre 15 y 128 caracteres, aceptar espacios y caracteres Unicode, no exigir reglas de composición y rechazarse si pertenecen a una lista de contraseñas comunes o comprometidas.
- **FR-003**: El sistema DEBE quitar espacios al inicio y al final del correo y comparar las direcciones sin distinguir mayúsculas para impedir el registro duplicado. Ante un correo ya registrado, debe responder con un mensaje genérico que no revele si la cuenta existe.
- **FR-004**: El registro DEBE requerir que la persona declare ser mayor de edad. Si no declara mayoría de edad, no se debe habilitar una cuenta.
- **FR-005**: El sistema DEBE verificar el correo mediante un enlace de un solo uso que vence 24 horas después de su emisión. Cada reenvío invalida el enlace de verificación anterior. La cuenta no se considera verificada hasta completar la validación; si el correo no puede enviarse o verificarse, no se completa la verificación.
- **FR-006**: El sistema DEBE aplicar CAPTCHA durante el registro; si CAPTCHA no puede validarse, el registro se deniega. El proveedor queda pendiente para la planificación técnica.
- **FR-007**: La contraseña DEBE almacenarse usando Argon2; nunca se debe almacenar ni devolver en texto plano.

### Inicio de sesión y sesiones

- **FR-008**: El sistema DEBE permitir el inicio de sesión con correo y contraseña.
- **FR-009**: El sistema DEBE aplicar CAPTCHA durante el inicio de sesión; si CAPTCHA no puede validarse, el inicio de sesión se deniega. El proveedor queda pendiente para la planificación técnica.
- **FR-010**: Tras autenticar correctamente, el sistema DEBE emitir JWT de acceso con duración de 15 minutos, transportado en cookie httpOnly y HTTPS.
- **FR-011**: El sistema DEBE emitir refresh tokens con duración de 7 días y rotarlos en cada uso. La reutilización de un refresh token reemplazado DEBE revocar la sesión completa.
- **FR-012**: El sistema DEBE permitir cerrar sesión revocando la sesión actual. DEBE revocar todas las sesiones tras un cambio/restablecimiento de contraseña, recuperación/restablecimiento de TOTP, cambio de rol o revocación administrativa por seguridad; cada causa DEBE quedar auditada.
- **FR-013**: El sistema DEBE rechazar el uso o renovación de una sesión/token revocado.
- **FR-014**: Una cuenta cuyo correo no haya sido verificado NO DEBE poder iniciar sesión ni obtener una sesión autenticada. Solo puede acceder a las rutas públicas de verificación de correo y recuperación.

### Segundo factor

- **FR-015**: El sistema DEBE soportar TOTP como segundo factor.
- **FR-016**: El usuario DEBE poder configurar y activar TOTP mediante un flujo que confirme la posesión del autenticador antes de marcarlo activo.
- **FR-017**: Cuando TOTP esté activo, el sistema DEBE validar un código TOTP en cada inicio de sesión antes de conceder acceso.
- **FR-018**: El sistema DEBE denegar retiros si no se ha satisfecho un segundo factor válido. La aplicación de este control al flujo de retiros de F6 debe integrarse con la especificación de retiros.
- **FR-019**: Al activar TOTP, el sistema DEBE emitir códigos de recuperación de un solo uso. Recuperar el acceso por pérdida del autenticador DEBE requerir un código no usado y verificación del correo registrado. Al completar la recuperación, el sistema DEBE consumir el código usado, invalidar el autenticador perdido y los códigos restantes, revocar todas las sesiones y requerir configurar y confirmar un nuevo TOTP antes de permitir el login pleno. Un código utilizado no puede volver a utilizarse.
- **FR-034**: El sistema DEBE permitir restablecer una contraseña olvidada mediante un enlace de un solo uso enviado al correo verificado, válido por 30 minutos. La solicitud pública DEBE devolver la misma respuesta genérica para direcciones asociadas y no asociadas a una cuenta y no revelar si existe una cuenta; el enlace solo se envía cuando la dirección corresponde al correo verificado de una cuenta. Al completar el cambio, DEBE revocar las sesiones activas de la cuenta y mantener TOTP habilitado si estaba activo.

### Roles y autorización

- **FR-020**: El sistema DEBE contemplar los roles `apostador`, `operador` y `administrador`.
- **FR-021**: El backend DEBE aplicar control de acceso basado en roles en cada endpoint protegido.
- **FR-022**: El registro, login, verificación de correo e inicio de recuperación son operaciones públicas. La renovación de sesión y la finalización de verificaciones requieren su credencial correspondiente. Las demás operaciones protegidas DEBEN denegarse por defecto si el usuario no está autenticado o no existe autorización explícita.
- **FR-023**: Las rutas y acciones administrativas DEBEN estar protegidas y solo ser accesibles por autorización administrativa explícita. El primer administrador DEBE provisionarse mediante un proceso controlado; administradores pueden asignar o retirar roles de operador. Los cambios del rol administrador DEBEN requerir provisión controlada y dejar auditoría.
- **FR-024**: El sistema DEBE respetar las capacidades generales de apostador, operador y administrador descritas en la tabla de actores. Cada especificación de dominio posterior DEBE detallar y asignar permisos a sus propias operaciones; esta especificación no define endpoints de otras fases.

### Prevención de abuso y auditoría

- **FR-026**: El sistema DEBE bloquear el inicio de sesión de una cuenta durante 15 minutos al acumular 5 validaciones fallidas de contraseña en una ventana móvil de 15 minutos. Un código TOTP incorrecto no incrementa este contador. El contador de fallos de contraseña DEBE reiniciarse tras un login exitoso o al terminar el bloqueo.
- **FR-027**: El sistema DEBE mitigar ataques de fuerza bruta mediante rate limiting, bloqueo por intentos fallidos y CAPTCHA en registro e inicio de sesión.
- **FR-028**: El sistema DEBE limitar a 20 los intentos de inicio de sesión desde una misma dirección IP en una ventana móvil de 15 minutos; cada intento deja de contar al cumplir 15 minutos. Al alcanzar el límite por IP, se rechazan nuevos intentos desde esa IP durante el resto de la ventana. El bloqueo por cuenta se rige exclusivamente por FR-026.
- **FR-029**: El sistema DEBE validar las entradas y manejar errores de autenticación/autorización sin exponer credenciales, secretos, tokens ni detalles internos que faciliten abuso.
- **FR-030**: El sistema DEBE registrar éxitos y fallos de autenticación, cambios de credenciales y factores, emisión/rotación/revocación de sesiones, denegaciones de autorización y cambios administrativos.
- **FR-031**: Los registros de auditoría DEBEN ser append-only: las operaciones normales de la aplicación no deben permitir modificar ni eliminar eventos previos. Si no se puede persistir el evento requerido, la acción sensible correspondiente DEBE denegarse.
- **FR-032**: Cada evento de auditoría DEBE registrar actor, acción, fecha/hora, IP y dispositivo.
- **FR-035**: Los eventos de auditoría definidos en FR-030 DEBEN conservarse durante un año; las operaciones normales de la aplicación no pueden modificar ni eliminar eventos dentro de ese periodo.
- **FR-036**: Los códigos TOTP DEBEN generarse en periodos de 30 segundos. Para validar, el sistema DEBE aceptar el periodo actual y un periodo adyacente anterior o posterior.
- **FR-037**: El sistema DEBE aceptar como máximo una vez cada periodo TOTP por cuenta; todo intento posterior de usar un código del mismo periodo DEBE rechazarse en cualquier flujo.
- **FR-038**: Si una cuenta acumula 5 códigos TOTP incorrectos en 15 minutos, el sistema DEBE bloquear las verificaciones TOTP de esa cuenta durante 15 minutos, registrar el evento y mantener el factor TOTP activo. Al finalizar el bloqueo, el contador TOTP DEBE reiniciarse; una verificación TOTP exitosa también DEBE reiniciarlo. En login, un TOTP incorrecto incrementa este contador TOTP, pero no el contador de fallos de contraseña definido en FR-026; el intento sí cuenta para el límite por IP de FR-028.

## Reglas de negocio

- **BR-001**: Solo una persona que declare ser mayor de edad puede completar el registro de una cuenta utilizable. No se especifica método de comprobación documental.
- **BR-002**: La verificación del correo es requisito para considerar verificada la cuenta.
- **BR-003**: Para impedir cuentas duplicadas, las direcciones de correo se comparan tras quitar espacios al inicio y al final y sin distinguir mayúsculas, conforme a FR-003.
- **BR-004**: La contraseña se almacena como hash Argon2.
- **BR-005**: El acceso a cada endpoint protegido requiere autenticación y permiso explícito; la ausencia de regla equivale a denegación.
- **BR-006**: Los roles disponibles son apostador, operador y administrador. El primer administrador se provisiona mediante un proceso controlado; los administradores pueden asignar o retirar el rol de operador. Los cambios del rol administrador requieren provisión controlada y auditoría. Ningún usuario puede autoasignarse un rol privilegiado.
- **BR-007**: El retiro requiere 2FA válido, según PLAN.md; el proceso de retiro pertenece a F6.
- **BR-008**: Las acciones sensibles dejan auditoría append-only, incluyendo actor, acción, momento, IP y dispositivo.
- **BR-009**: Las credenciales se transportan sobre HTTPS. JWT de acceso se entrega en cookie httpOnly; los demás atributos seguros de cookie y política CSRF quedan por definir técnicamente.

## Escenarios de uso y aceptación

### Escenario A — Registro satisfactorio

**Dado** un visitante con correo no registrado, datos válidos y declaración de mayoría de edad afirmativa
**Cuando** completa CAPTCHA y envía el registro
**Entonces** el sistema inicia la verificación del correo y no presenta la cuenta como verificada antes de completar dicha verificación.

### Escenario B — Registro rechazado

**Dado** un visitante que declara no ser mayor de edad, aporta datos inválidos, usa un correo ya registrado o no satisface CAPTCHA
**Cuando** intenta registrarse
**Entonces** no obtiene una cuenta utilizable y se informa un error seguro sin filtrar datos sensibles de otra cuenta.

### Escenario C — Inicio de sesión

**Dado** un usuario con correo verificado y credenciales válidas
**Cuando** supera CAPTCHA y, si tiene TOTP activo, valida el código TOTP
**Entonces** recibe una sesión con JWT de 15 minutos en cookie httpOnly y refresh token rotativo de 7 días.

### Escenario D — Credenciales incorrectas y fuerza bruta

**Dado** una solicitud de inicio de sesión con credenciales incorrectas
**Cuando** se acumulan 5 validaciones fallidas de contraseña para la cuenta dentro de 15 minutos o 20 intentos desde la misma IP dentro de 15 minutos
**Entonces** el sistema bloquea el login de la cuenta durante 15 minutos al alcanzar el umbral de contraseña y rechaza nuevos intentos desde la IP durante el resto de su ventana; no crea una sesión y registra los eventos pertinentes. Un TOTP incorrecto incrementa únicamente el contador TOTP de FR-038 y también cuenta para el límite por IP.

### Escenario E — Rotación y revocación

**Dado** un refresh token válido
**Cuando** se utiliza para renovar la sesión
**Entonces** se rota el refresh token; el token reemplazado no puede volver a renovar y su reutilización revoca la sesión completa. El JWT de acceso dura 15 minutos y el refresh token 7 días.

### Escenario F — Cierre de sesión

**Dado** un usuario autenticado
**Cuando** cierra sesión
**Entonces** la sesión actual queda revocada y no puede renovar el acceso. Una acción de seguridad puede revocar todas las sesiones de la cuenta.

### Escenario G — Activación TOTP

**Dado** un usuario que configura TOTP
**Cuando** completa el paso de confirmación exigido por el flujo
**Entonces** el segundo factor queda activo; un código inválido no activa el factor.

Al activar TOTP, el sistema entrega códigos de recuperación de un solo uso. La recuperación por pérdida del autenticador solo se completa tras validar uno de esos códigos y verificar el correo registrado.

### Escenario K — Recuperación de contraseña

**Dado** un usuario con correo verificado que solicita restablecer su contraseña
**Cuando** completa el cambio mediante un enlace de un solo uso antes de que venza a los 30 minutos
**Entonces** se cambia la contraseña, se revocan las sesiones activas y se mantiene TOTP habilitado si lo tenía activo.

### Escenario H — Retiro sin segundo factor

**Dado** un usuario que solicita un retiro sin completar TOTP/2FA válido
**Cuando** el backend autoriza la operación
**Entonces** la operación se deniega y la denegación queda registrada conforme a la política de auditoría.

### Escenario I — Autorización por rol

**Dado** un endpoint protegido por un permiso asignado a un rol
**Cuando** lo invoca una persona sin sesión, sin rol permitido o con rol insuficiente
**Entonces** el backend deniega el acceso. Un apostador no puede ejecutar funciones de operador/administrador; un operador no puede ejecutar funciones exclusivas del administrador.

### Escenario J — Integridad de auditoría

**Dado** un evento de autenticación, autorización o seguridad ya registrado
**Cuando** una operación normal de la aplicación intenta cambiarlo o borrarlo
**Entonces** la operación no puede alterar ni eliminar ese evento y el historial conserva el registro original.

## Criterios de aceptación verificables

- **AC-001**: Un registro válido de correo nuevo con mayoría de edad declarada y CAPTCHA aceptado inicia la verificación; no se identifica como verificado antes de completarla.
- **AC-002**: El registro no crea una cuenta utilizable ante correo duplicado, datos no válidos, declaración negativa o CAPTCHA fallido.
- **AC-003**: No existe contraseña en texto plano persistida ni incluida en respuestas del sistema; el almacenamiento usa Argon2.
- **AC-004**: El inicio de sesión exitoso emite un JWT de acceso de 15 minutos en cookie httpOnly y una sesión con refresh token de 7 días rotado en cada uso.
- **AC-005**: Tras la rotación, el refresh token reemplazado no puede volver a emitir una sesión; intentar reutilizarlo revoca la sesión completa.
- **AC-006**: Cerrar sesión revoca la sesión actual y bloquea su renovación; una acción de seguridad puede revocar todas las sesiones de la cuenta.
- **AC-007**: El registro y el inicio de sesión se deniegan si CAPTCHA falla o no está disponible.
- **AC-008**: Tras 5 validaciones fallidas de contraseña de una cuenta dentro de 15 minutos, el login de la cuenta queda bloqueado durante 15 minutos; al llegar a 20 intentos desde una IP dentro de 15 minutos, se rechazan intentos adicionales de esa IP durante el resto de la ventana. Los fallos TOTP no se contabilizan como fallos de contraseña.
- **AC-009**: La activación de TOTP requiere confirmación de un código válido; una solicitud de retiro sin 2FA válido es denegada.
- **AC-010**: Para cada endpoint protegido se comprueba que usuario no autenticado, rol no autorizado y permiso ausente resultan en denegación.
- **AC-011**: Las acciones administrativas de gestión de usuario/roles no están disponibles para apostador u operador; los cambios administrativos y las denegaciones de autorización se registran conforme a FR-030.
- **AC-012**: Los eventos definidos por FR-030 se registran con actor, acción, fecha/hora, IP y dispositivo.
- **AC-013**: Las operaciones normales de la aplicación no pueden editar ni borrar eventos ya insertados en auditoría.
- **AC-014**: Errores de autenticación y autorización no exponen contraseñas, tokens, secretos ni detalles internos.
- **AC-015**: Las solicitudes y respuestas de registro, login, refresh, configuración/validación TOTP y recuperación de acceso se transportan mediante HTTPS; el sistema no envía credenciales ni tokens de sesión por HTTP.
- **AC-016**: Registro, login, verificación de correo e inicio de recuperación pueden iniciarse sin sesión autenticada; renovar sesión y completar verificaciones requiere la credencial correspondiente; cualquier otra ruta protegida deniega solicitudes sin autenticación y autorización.
- **AC-017**: Si no se puede persistir el evento de auditoría requerido, la acción sensible se deniega y el sistema no indica que fue completada.
- **AC-018**: Al activar TOTP se emiten códigos de recuperación de un solo uso; la recuperación requiere un código no utilizado y verificación del correo registrado. Al completarse, invalida el factor perdido y los códigos restantes, revoca todas las sesiones y requiere confirmar un nuevo TOTP antes de permitir el login pleno.
- **AC-019**: Una cuenta con TOTP activo no puede completar el inicio de sesión sin validar un código TOTP válido.
- **AC-020**: El registro público no permite asignar roles de operador ni administrador; el primer administrador se provisiona de forma controlada, las asignaciones de operador requieren rol administrador y los cambios del rol administrador siguen el proceso controlado y auditado.
- **AC-021**: El enlace de recuperación de contraseña solo puede usarse una vez y durante los 30 minutos posteriores a su emisión; al completar el cambio se revocan sesiones activas y TOTP continúa activo si estaba habilitado.
- **AC-022**: Correos con espacios externos o diferencias de mayúsculas/minúsculas se tratan como la misma identidad; el registro duplicado devuelve un mensaje genérico. El enlace de verificación vence a las 24 horas, es de un solo uso y un reenvío invalida el enlace anterior.
- **AC-023**: Los eventos definidos se conservan durante un año y no se pueden editar ni borrar mediante operaciones normales de la aplicación.
- **AC-024**: TOTP acepta códigos del periodo actual de 30 segundos y de un periodo adyacente anterior o posterior; códigos fuera de esa ventana se rechazan.
- **AC-025**: Después de aceptar un código TOTP para una cuenta, cualquier nuevo intento de usar un código de ese mismo periodo en cualquier flujo se rechaza.
- **AC-026**: Tras 5 códigos TOTP incorrectos para una cuenta en 15 minutos, se rechazan sus verificaciones TOTP durante 15 minutos; el factor permanece activo y el bloqueo queda auditado. Al concluir el bloqueo, el contador TOTP queda reiniciado; una verificación TOTP exitosa también lo reinicia.
- **AC-027**: Cambio/restablecimiento de contraseña, recuperación/restablecimiento de TOTP, cambio de rol y revocación administrativa por seguridad invalidan todas las sesiones activas y dejan un evento de auditoría.
- **AC-028**: Un login exitoso o el fin del bloqueo reinicia el contador de fallos de contraseña de la cuenta; el contador IP usa ventana móvil y cada intento deja de contar tras 15 minutos. La verificación TOTP exitosa o el fin de su bloqueo reinician por separado el contador TOTP conforme a FR-038.
- **AC-029**: El inicio de sesión de una cuenta con correo no verificado se deniega y no emite JWT ni refresh token; siguen disponibles únicamente las rutas públicas de verificación y recuperación.
- **AC-030**: Registro y restablecimiento rechazan contraseñas de menos de 15 o más de 128 caracteres y las incluidas en la lista de contraseñas comunes o comprometidas; aceptan espacios y Unicode y no requieren combinaciones de clases de caracteres.
- **AC-031**: Solicitudes públicas de recuperación de contraseña producen la misma respuesta genérica para un correo registrado y uno no registrado; solo se envía un enlace al correo verificado asociado a una cuenta.
- **AC-032**: Durante el login, una contraseña incorrecta incrementa el contador por cuenta de FR-026; un TOTP incorrecto incrementa el contador de FR-038 y no el de FR-026; ambos intentos cuentan para el límite por IP de FR-028.
- **AC-033**: Al llegar al umbral especificado, el contador de contraseña bloquea el login de la cuenta conforme a FR-026 y el contador TOTP bloquea las verificaciones TOTP conforme a FR-038; ninguno de esos bloqueos modifica el umbral o la ventana del otro contador.

## Casos de error y límite

- Correo duplicado: quitar espacios externos y comparar sin distinguir mayúsculas; no revelar la existencia de la cuenta.
- Cuenta registrada pero aún no verificada: denegar login y no emitir sesión; permitir solo verificación y recuperación. Un enlace reenviado invalida el previo y todos vencen a las 24 horas.
- CAPTCHA no disponible o inválido: denegar registro o inicio de sesión; el proveedor queda para la planificación técnica.
- Intentos concurrentes: cada intento debe contar para los límites definidos por cuenta y por IP; al alcanzar un límite, se aplica el bloqueo o rechazo correspondiente.
- Las ventanas por cuenta e IP son móviles; login exitoso o fin del bloqueo reinician el contador de la cuenta y cada intento IP deja de contar tras 15 minutos.
- Reutilización de refresh token después de rotación: revocar la sesión completa.
- Expiración de JWT/refresh token durante una operación: al vencer el JWT (15 minutos) o refresh token (7 días), no se acepta para renovar; las revocaciones de sesión descritas se aplican también a tokens emitidos.
- Código TOTP fuera del periodo actual y de los periodos adyacentes anterior/posterior: rechazar. Rechazar también el uso de un periodo TOTP ya aceptado por la cuenta. Tras 5 códigos incorrectos de una cuenta en 15 minutos, bloquear la verificación TOTP por 15 minutos sin desactivar el factor; reiniciar su contador al terminar el bloqueo o tras una verificación exitosa. Los fallos TOTP no incrementan el contador de contraseñas.
- Pérdida del dispositivo TOTP: si falta un código de recuperación no usado o no puede verificarse el correo, no se restablece el factor mediante este flujo. Si la recuperación se completa, invalida el factor perdido y los códigos restantes, revoca sesiones y exige confirmar un nuevo factor antes del login pleno.
- Servicio de correo no disponible: no completar ni marcar como verificada la cuenta. CAPTCHA no disponible: denegar registro o inicio de sesión; no existe bypass.
- Enlace de recuperación de contraseña vencido o ya utilizado: rechazar el cambio y no modificar la contraseña ni las sesiones.
- Solicitud de recuperación para correo no registrado: devolver la misma respuesta genérica que para correo registrado y no enviar enlace.
- Rol ausente, desconocido, desactualizado o permiso sin configurar: denegar por defecto.
- Fallo al insertar auditoría para acción sensible: denegar la acción y no presentarla como completada.
- Solicitud de modificación/eliminación de evento de auditoría: rechazar mediante operaciones ordinarias de aplicación.

## Requisitos no funcionales

### Seguridad

- La seguridad prevalece sobre comodidad, rendimiento y plazos.
- La solución debe ajustarse a OWASP Top 10 y usar HTTPS obligatorio.
- El backend NestJS es autoridad para autenticación, autorización y permisos; el cliente no puede decidir su propio rol.
- JWT de corta duración va en cookie httpOnly; contraseñas se almacenan mediante Argon2.
- Se aplican CAPTCHA, rate limiting, bloqueo por intentos fallidos, validación de entradas y manejo seguro de errores.
- El acceso se deniega por defecto y cada endpoint protegido verifica rol/permisos.
- Las acciones sensibles se registran con quién, qué, cuándo, IP y dispositivo; los eventos anteriores son inmutables para las operaciones normales.
- No se establecen objetivos numéricos de latencia, disponibilidad o volumen en los documentos de gobierno consultados; deben definirse solo si resultan necesarios para diseño y validación.

### Privacidad

- Correo, IP, identificador de dispositivo, factores TOTP y datos de auditoría son datos sensibles de cuenta y deben tratarse solo para identidad, seguridad y trazabilidad propias del alcance.
- Los eventos de auditoría se conservan un año; la minimización específica de datos de dispositivo, otros periodos de retención, procedimiento de exportación/eliminación de datos y texto de privacidad quedan pendientes.
- Secretos y credenciales no deben exponerse en cliente, respuestas de error o logs. El manejo de secretos sigue las restricciones de la constitución.

### Rendimiento y confiabilidad

- Los documentos consultados no definen objetivos de rendimiento o disponibilidad para autenticación; cualquier SLO/umbral cuantitativo requiere decisión explícita.
- La persistencia append-only debe conservar los eventos previos frente a operaciones ordinarias de la aplicación.

## Dependencias e integraciones

- **F0 / monorepo**: `apps/web` (Next.js) ofrece la interfaz; `apps/api` (NestJS) aplica la lógica de identidad y autorización; PostgreSQL es la base principal y Redis está disponible para operaciones que lo requieran. La selección concreta de almacenamiento de sesiones/contadores queda para el plan técnico.
- **Servicio de correo**: necesario para verificación de correo, restablecimiento de contraseña y verificación de identidad durante recuperación TOTP; proveedor y contrato pendientes.
- **CAPTCHA**: requerido en registro y login; proveedor y contrato pendientes.
- **F2–F7**: billetera/retiros, partidos, apuestas, promociones y reportes deben integrar el control de acceso. En particular F6 debe rechazar retiro sin segundo factor. F7 definirá como dependencia futura el contrato para consumir/validar la identidad y el rol administrativos en reportes; no forma parte de los requisitos funcionales de F1.
- **Auditoría**: módulo transversal iniciado en F1 y utilizado por fases posteriores para acciones sensibles.

## Restricciones y supuestos

- Se respeta el monorepo con pnpm/Turborepo, frontend Next.js TypeScript, backend NestJS TypeScript, PostgreSQL principal y Redis cuando la operación lo requiera.
- Las decisiones técnicas de base de PLAN.md para F1 son Argon2, JWT de corta duración en cookie httpOnly, refresh rotativo y TOTP.
- La plataforma es académica y no procesa dinero real.
- No se presume edad mínima legal concreta ni verificación documental que no estén escritas en los documentos fuente. Los límites de login, normalización y verificación de correo están definidos en FR-026–FR-028, FR-003 y FR-005. La recuperación TOTP queda definida por FR-019.
- Las operaciones privilegiadas requieren autorización explícita y sus asignaciones iniciales no se deben inferir de auto-registro.
- F1 establece las capacidades de identidad y autorización; la funcionalidad propia de fases posteriores no se implementa en esta especificación.

## Decisiones pendientes

### Decisiones funcionales por resolver antes de cerrar la especificación

No quedan decisiones funcionales pendientes de esta ronda.

### Decisiones para planificación técnica

- Proveedor y contrato de correo y CAPTCHA; el comportamiento funcional ante fallo ya está definido como denegación del flujo afectado.
- Tecnología de almacenamiento de sesiones, refresh tokens, códigos TOTP y códigos de recuperación, y mecanismos de protección de secretos e invalidación de sesiones.
- Atributos seguros adicionales de cookies y controles CSRF, sin debilitar `httpOnly` ni HTTPS.
- SLO de latencia/disponibilidad, observabilidad y estrategia de despliegue, no definidos por los documentos fuente.
- Fuente concreta y mecanismo de actualización de la lista de contraseñas comunes o comprometidas indicada por FR-002.

## Ambigüedades restantes

Las decisiones reservadas para planificación técnica están enumeradas en [Decisiones pendientes](#decisiones-pendientes). La tolerancia temporal, prevención de reutilización, límite, bloqueo y reinicio del contador ante códigos TOTP incorrectos ya están definidos.

## Glosario

- **JWT de acceso**: credencial de corta duración usada para autenticar solicitudes.
- **Refresh token rotativo**: credencial de renovación que se reemplaza al usarla.
- **TOTP**: código temporal de un solo uso generado por un autenticador compartido con la cuenta.
- **2FA**: autenticación que exige dos factores; este documento no presupone métodos de recuperación.
- **RBAC**: control de acceso basado en roles.
- **Append-only**: registro al que se agregan eventos sin modificar ni borrar los anteriores mediante operaciones normales de aplicación.
