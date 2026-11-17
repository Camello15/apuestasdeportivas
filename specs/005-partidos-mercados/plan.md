# Especificación 005: Partidos y Mercados

## 1. Resumen
Gestión integral de competiciones deportivas, partidos con máquina de estados controlada, mercados de apuestas y cuotas administradas por operadores, además de la cartelera pública para consulta de apostadores[cite: 2, 3].

## 2. Actores
- **Apostador / Visitante**: consulta competiciones activas, partidos disponibles, marcadores, mercados abiertos y cuotas vigentes[cite: 2].
- **Operador / Administrador**: crea y administra competiciones, partidos, transiciones de estado, mercados y cuotas manuales[cite: 2].

## 3. Requisitos Funcionales
- **RF-01 Gestión de competiciones**: listar competiciones activas y permitir a operadores crear nuevas competiciones (`name`, `country`, `sport`).
- **RF-02 Gestión de partidos**: crear partidos asociados a una competición (`homeTeam`, `awayTeam`, `startsAt`) con estado inicial `SCHEDULED`[cite: 2].
- **RF-03 Máquina de estados del partido**: validar estrictamente las transiciones permitidas[cite: 2, 3]:
  - `SCHEDULED` -> `LIVE` | `POSTPONED` | `CANCELLED`
  - `LIVE` -> `FINISHED` | `SUSPENDED`
  - `SUSPENDED` -> `LIVE` | `POSTPONED` | `CANCELLED`
  - `POSTPONED` -> `SCHEDULED` | `CANCELLED`
  - `FINISHED` y `CANCELLED` son estados terminales.
- **RF-04 Cierre automático de mercados**: al transicionar un partido a `FINISHED`, `SUSPENDED`, `POSTPONED` o `CANCELLED`, todos sus mercados en estado `OPEN` cambian automáticamente (`CLOSED`, `SUSPENDED` o `VOID`).
- **RF-05 Mercados y cuotas**: permitir crear mercados (mínimo 2 selecciones) y actualizar cuotas (`odds > 1.00`) o estados de mercado (`OPEN`, `SUSPENDED`, `CLOSED`, `VOID`)[cite: 2].
- **RF-06 Cartelera UI**: mostrar listado de partidos y vista de detalle con todos sus mercados y cuotas en `apps/web`[cite: 2].

## 4. Criterios de Aceptación
- Toda transición de estado inválida responde con HTTP `400 Bad Request`.
- Todas las operaciones de mutación quedan registradas en la tabla append-only `audit_events`[cite: 2, 4].
- Usuarios sin permiso `matches:manage` reciben HTTP `403 Forbidden` al intentar crear o modificar partidos, mercados o cuotas.