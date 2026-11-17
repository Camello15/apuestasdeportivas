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

## Guía de ejecución local (probada en Linux)

Requisitos: Node 22+, pnpm, Docker y uv.

1. **Infraestructura:** `docker compose up -d` (PostgreSQL en el 5432 y Redis en el 6379). Si esos puertos los ocupan servicios del sistema, detenlos antes: `sudo systemctl stop postgresql redis-server`.
2. **Variables de entorno:**
   - Raíz: `cp .env.example .env`.
   - `apps/api/.env`: las variables descritas en `apps/api/AUTH_CONFIGURATION.md` (conexiones a la base, claves JWT, pepper, clave TOTP y CAPTCHA).
   - `apps/web/.env.local`: `API_BASE_URL` (HTTPS), `WEB_ORIGIN`, `CSRF_SECRET` (mínimo 32 bytes) y `NEXT_PUBLIC_CAPTCHA_SITE_KEY`.
3. **Usuarios de conexión en PostgreSQL.** Las migraciones crean los roles `auth_runtime`, `auth_migrator` y `auth_maintenance` sin login, pero no los usuarios con los que se conectan la API y las migraciones. Créalos con `docker compose exec postgres psql -U apuestas -d apuestas`:

   ```sql
   CREATE ROLE migrator LOGIN SUPERUSER PASSWORD '<clave-migrator>';
   CREATE ROLE app_runtime LOGIN PASSWORD '<clave-runtime>';
   ```

   `migrator` como superusuario es solo para desarrollo local. Usa las mismas claves en `DATABASE_URL` y `MIGRATION_DATABASE_URL` de `apps/api/.env`.

4. **Migraciones:** `cd apps/api && DATABASE_URL="<MIGRATION_DATABASE_URL>" pnpm exec prisma migrate deploy`. Después, en psql: `GRANT auth_runtime TO app_runtime;`.
5. **Arrancar:** `pnpm dev`. La web queda en http://localhost:3000 (entra siempre por ese puerto) y la API en el 3001.

### Proxy HTTPS entre la web y la API

El BFF (`apps/web/app/api/backend/[...path]/route.ts`) solo reenvía a una `API_BASE_URL` con HTTPS. En local hace falta un proxy TLS con certificado autofirmado delante de la API (por ejemplo en el 3002) y arrancar la web con `NODE_EXTRA_CA_CERTS=<ruta/cert.pem>`.

### Problemas conocidos

- **Login y registro responden 403 en el navegador.** `GET /api/backend/auth/csrf` exige que la cabecera `Origin` coincida con `WEB_ORIGIN`, y los navegadores no la envían en un GET al mismo sitio. Con `curl -H "Origin: http://localhost:3000"` sí devuelve el token. Es la causa probable y está pendiente de revisión por el equipo de la spec 002.
- El registro verifica el correo y no hay SMTP configurado en local.
- `/matches` responde con la lista vacía hasta que se creen partidos.
