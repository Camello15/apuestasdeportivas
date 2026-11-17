# Tareas 005: Partidos y Mercados

- [x] **T-001**: Documentar especificación (`spec.md`), plan técnico (`plan.md`) y tareas (`tasks.md`) en `specs/005-partidos-mercados/`.
- [ ] **T-002**: Definir modelos `Competition`, `Match`, `Market`, `Selection` y generar migración Prisma en `apps/api/prisma/`[cite: 2].
- [ ] **T-003**: Implementar máquina de estados (`match-state-machine.ts`) y DTOs de validación (`matches.dto.ts`).
- [ ] **T-004**: Implementar `MatchesService`, `MatchesController` y `MatchesModule`, registrándolo en `AppModule`[cite: 1].
- [ ] **T-005**: Agregar permiso `matches:manage` en `permissions.seed.ts` para roles operador y administrador[cite: 1].
- [ ] **T-006**: Escribir pruebas unitarias de la máquina de estados en `apps/api/test/matches.spec.ts`.
- [ ] **T-007**: Implementar vistas `/matches` y `/matches/[matchId]` en `apps/web/app/matches/`[cite: 2].
- [ ] **T-008**: Ejecutar `pnpm lint`, `pnpm build` y `pnpm test` antes de abrir el PR hacia `develop`[cite: 2].