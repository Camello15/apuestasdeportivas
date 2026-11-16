# Plan Técnico 005: Partidos y Mercados

## 1. Arquitectura y Stack
- **Base de datos (PostgreSQL + Prisma)**: agregar enums `MatchStatus` y `MarketStatus`, y modelos `Competition`, `Match`, `Market` y `Selection` en `apps/api/prisma/schema.prisma`[cite: 2, 4].
- **Backend (`apps/api`)**: módulo `MatchesModule` en NestJS con validación de DTOs (`class-validator`), máquina de estados aislada en `match-state-machine.ts`, control de permisos mediante `@RequirePermissions('matches:manage')` y auditoría mediante `AuditService`[cite: 1, 2].
- **Frontend (`apps/web`)**: rutas App Router `/matches` (cartelera) y `/matches/[matchId]` (detalle de mercados)[cite: 2].

## 2. Endpoints API
- `GET /competitions` (Público)
- `POST /competitions` (Permiso: `matches:manage`)
- `GET /matches` (Público, filtros opcionales `status`, `competitionId`)
- `GET /matches/:matchId` (Público)
- `POST /matches` (Permiso: `matches:manage`)
- `PATCH /matches/:matchId/status` (Permiso: `matches:manage`)
- `POST /matches/:matchId/markets` (Permiso: `matches:manage`)
- `PATCH /markets/:marketId/status` (Permiso: `matches:manage`)
- `PATCH /selections/:selectionId/odds` (Permiso: `matches:manage`)

## 3. Estrategia de Pruebas
- Pruebas unitarias en Jest (`apps/api/test/matches.spec.ts`) cubriendo transiciones válidas, rechazo de transiciones inválidas y suspensión automática de mercados[cite: 2].