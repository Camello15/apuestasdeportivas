# Apuestas Deportivas

Sistema web de apuestas deportivas — proyecto académico UTPL (Arquitectura de Software).
Requisitos: [`promtp.md`](promtp.md) · Plan: [`PLAN.md`](PLAN.md) · Specs: [`specs/README.md`](specs/README.md)

## Requisitos locales

Node 22+, pnpm, Docker y [uv](https://docs.astral.sh/uv/).

## Puesta en marcha

```bash
cp .env.example .env
pnpm install
docker compose up -d        # PostgreSQL y Redis
(cd apps/reports && uv sync)
pnpm dev                    # web :3000, api :3001
(cd apps/reports && uv run uvicorn app.main:app --reload --port 8000)
```

Comprobación: `http://localhost:3000/api/health`, `http://localhost:3001/health`,
`http://localhost:8000/health` deben responder `status: ok`.

## Comandos

| Comando                                                     | Qué hace                     |
| ----------------------------------------------------------- | ---------------------------- |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Calidad de web, api y shared |
| `cd apps/reports && uv run pytest` / `uv run ruff check .`  | Pruebas y lint de reportes   |
| `pnpm --filter @apuestas/api test -- health`                | Una sola prueba de la API    |

## Flujo de trabajo

Git Flow: `main`, `develop`, `feature/*`. Cada integrante trabaja su spec en `feature/spec-N-nombre`
y entra a `develop` por Pull Request con CI en verde. Commits con Conventional Commits.
