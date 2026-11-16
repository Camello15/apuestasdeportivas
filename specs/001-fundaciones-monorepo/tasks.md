# Tasks: Fundaciones del monorepo

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

## Phase 1: Setup

- [x] T001 Monorepo pnpm + Turborepo (`package.json`, `pnpm-workspace.yaml`, `turbo.json`)
- [x] T002 [P] TypeScript base estricto (`tsconfig.base.json`)
- [x] T003 [P] ESLint, Prettier y EditorConfig
- [x] T004 [P] Commitlint + Husky para Conventional Commits

## Phase 2: User Story 1 — Levantar el proyecto (P1)

- [x] T005 [US1] `packages/shared` con tipos compartidos
- [x] T006 [US1] `apps/web` Next.js con página inicial y `GET /api/health`
- [x] T007 [US1] `apps/api` NestJS con `GET /health` y prueba Jest + Supertest
- [x] T008 [US1] `apps/reports` FastAPI con `GET /health`, prueba pytest y Ruff
- [x] T009 [US1] `docker-compose.yml` (PostgreSQL y Redis) y `.env.example`

## Phase 3: User Story 2 — Calidad automática (P1)

- [x] T010 [US2] Workflow `.github/workflows/ci.yml` (lint, tipos, tests, build, SonarQube opcional)
- [x] T011 [US2] Plantillas de issue y Pull Request
- [ ] T012 [US2] Proteger `main` y `develop` en GitHub (PR obligatorio, CI requerido)

## Phase 4: User Story 3 — Despliegue y trazabilidad (P2)

- [ ] T013 [US3] Crear proyecto en Vercel para `apps/web` (staging desde `develop`)
- [ ] T014 [US3] Crear servicios en Render con `render.yaml` (api y reports)
- [ ] T015 [US3] Activar SonarQube Cloud: `SONAR_TOKEN` y variable `SONAR_ENABLED=true`
- [ ] T016 [US3] Dashboard de Grafana Cloud con datasource de GitHub

## Polish

- [x] T017 README y comandos reales en `CLAUDE.md`
- [ ] T018 Abrir PR a `develop` y verificar CI en verde
