# Feature Specification: Fundaciones del monorepo

**Feature Branch**: `feature/spec-1-fundaciones-monorepo`
**Created**: 2026-11-16
**Status**: En curso
**Input**: Fase F0 de `PLAN.md` — configurar e inicializar el stack tecnológico base del proyecto para que el resto del equipo pueda clonar y construir sus specs encima.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Clonar y levantar el proyecto en minutos (Priority: P1)

Como integrante del equipo quiero clonar el repositorio, instalar dependencias y levantar las tres
apps y la infraestructura local con pocos comandos, para empezar a desarrollar mi spec sin
configurar nada.

**Why this priority**: sin esto el resto del equipo no puede trabajar; bloquea a los demás specs.

**Independent Test**: en una máquina limpia, `pnpm install`, `docker compose up -d` y `pnpm dev`
dejan web, api y reports respondiendo.

**Acceptance Scenarios**:

1. **Given** un clon limpio, **When** ejecuto `pnpm install && pnpm build`, **Then** las apps
   `web` y `api` y el paquete `shared` compilan sin errores.
2. **Given** `docker compose up -d`, **When** consulto PostgreSQL y Redis, **Then** ambos
   reportan estado saludable.
3. **Given** las apps en marcha, **When** hago `GET /health` en api (3001) y reports (8000) y
   `GET /api/health` en web (3000), **Then** cada una responde `200` con `status: ok`.

---

### User Story 2 - Calidad automática en cada Pull Request (Priority: P1)

Como equipo queremos que cada PR ejecute lint, tipos y pruebas automáticamente, para que nada
roto llegue a `develop`.

**Why this priority**: la constitución exige CI verde y quality gate antes de integrar.

**Independent Test**: abrir un PR con un error de lint o una prueba fallida y comprobar que el
workflow de CI falla.

**Acceptance Scenarios**:

1. **Given** un PR a `develop`, **When** corre GitHub Actions, **Then** se ejecutan lint, tipos,
   pruebas y build de Node, y lint + pytest de Python.
2. **Given** un commit con mensaje que no sigue Conventional Commits, **When** intento hacer
   commit, **Then** commitlint (Husky) lo rechaza.

---

### User Story 3 - Despliegue y trazabilidad (Priority: P2)

Como equipo queremos desplegar a staging y ver la trazabilidad del trabajo, para demostrar
entregas verticales y la colaboración del equipo.

**Why this priority**: necesario para el cierre de F0, pero no bloquea el desarrollo local.

**Independent Test**: un PR a `develop` despliega las tres apps en staging; Grafana muestra
commits y PRs.

**Acceptance Scenarios**:

1. **Given** un merge a `develop`, **When** termina el pipeline, **Then** las tres apps quedan
   desplegadas en staging (Vercel y Render).
2. **Given** el dashboard de Grafana, **When** lo abro, **Then** veo commits y PRs del equipo.

### Edge Cases

- Falta el archivo `.env`: se documenta copiar `.env.example`.
- Puertos 3000, 3001, 8000, 5432 o 6379 ocupados: se documentan en el README y son configurables.
- Servicios gratuitos de Render que se duermen: se precalientan antes de la demo.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El repositorio DEBE ser un monorepo pnpm + Turborepo con `apps/web`, `apps/api`,
  `apps/reports` y `packages/shared`.
- **FR-002**: `apps/web` DEBE ser Next.js (App Router, TypeScript) con una página inicial y
  `GET /api/health`.
- **FR-003**: `apps/api` DEBE ser NestJS (TypeScript) con `GET /health` y una prueba automática.
- **FR-004**: `apps/reports` DEBE ser FastAPI (Python 3.12, `uv`) con `GET /health` y una prueba.
- **FR-005**: DEBE existir `docker-compose.yml` con PostgreSQL y Redis y variables en `.env.example`.
- **FR-006**: DEBEN configurarse ESLint, Prettier, TypeScript estricto y Ruff.
- **FR-007**: DEBEN configurarse Husky y commitlint para Conventional Commits.
- **FR-008**: DEBE existir un workflow de GitHub Actions con lint → tipos → tests → build y un
  job opcional de SonarQube con quality gate.
- **FR-009**: DEBEN existir plantillas de issue y de Pull Request.
- **FR-010**: DEBEN existir los despliegues de staging en Vercel y Render y el dashboard de
  Grafana (dependen de cuentas externas).

### Key Entities

No aplica: este spec no introduce modelo de datos.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` terminan sin errores.
- **SC-002**: `pytest` y `ruff check` en `apps/reports` terminan sin errores.
- **SC-003**: los tres endpoints `/health` responden `200`.
- **SC-004**: un PR a `develop` ejecuta el CI completo.
- **SC-005** (cierre de F0): un PR a `develop` despliega las tres apps en staging.

## Assumptions

- El equipo usa Node 22+, pnpm, Docker y `uv` en local.
- Vercel, Render, SonarQube Cloud y Grafana Cloud se configuran con las cuentas del equipo.
- La seguridad de datos de negocio (ledger, auth) queda fuera de este spec y se cubre en los siguientes.
