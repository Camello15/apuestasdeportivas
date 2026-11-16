# Implementation Plan: Fundaciones del monorepo

**Branch**: `feature/spec-1-fundaciones-monorepo` | **Spec**: [spec.md](./spec.md)

## Summary

Crear el esqueleto ejecutable del sistema: tres aplicaciones mínimas con endpoint de salud,
infraestructura local con Docker Compose, calidad automática (lint, tipos, tests, commitlint) y
CI en GitHub Actions. Es la base sobre la que los demás specs construyen sus funcionalidades.

## Technical Context

**Language/Version**: TypeScript 5.9 (Node 22), Python 3.12
**Primary Dependencies**: Next.js, NestJS 11, FastAPI, pnpm + Turborepo, uv
**Storage**: PostgreSQL 16 y Redis 7 (solo infraestructura; sin esquema todavía)
**Testing**: Jest + Supertest (api), pytest (reports)
**Target Platform**: Vercel (web), Render (api, reports)
**Project Type**: monorepo web + api + servicio de reportes
**Constraints**: exactamente tres aplicaciones (constitución VI); sin Java ni Rust

## Constitution Check

| Principio                    | Cumplimiento                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| I. Seguridad y antifraude    | `.env` fuera del repo, secretos solo por variables de entorno; sin datos de negocio aún |
| II. Integridad financiera    | No aplica (sin dinero en este spec)                                                     |
| III. Servidor como autoridad | `web` solo presenta; la lógica vivirá en `api`                                          |
| IV. Pruebas primero          | Cada app trae una prueba de `/health` desde el inicio                                   |
| V. Tiempo real               | No aplica                                                                               |
| VI. Simplicidad              | Solo `web`, `api`, `reports` (+ paquete `shared`)                                       |
| VII. Accesibilidad           | `lang="es"` y base responsiva; la UI real llega en specs posteriores                    |

## Project Structure

```text
apps/web/        Next.js (App Router)
apps/api/        NestJS
apps/reports/    FastAPI (Python, uv)
packages/shared/ Tipos compartidos
specs/           Specs de Spec Kit
.github/         CI, plantillas de issue y PR
docker-compose.yml, turbo.json, pnpm-workspace.yaml
```

**Structure Decision**: monorepo con pnpm workspaces para Node; `apps/reports` se gestiona con
`uv` fuera del workspace de pnpm y el CI lo ejecuta en un job aparte.

## Complexity Tracking

Sin violaciones de la constitución.
