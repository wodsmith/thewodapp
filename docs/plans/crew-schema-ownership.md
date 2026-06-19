# Crew Schema Ownership

`packages/wodsmith-db` owns the shared PlanetScale schema, Drizzle config, generated migration intent, DB types, ID helpers, and pure MySQL Drizzle constructor for WODsmith Start and Crew.

Apps keep runtime-specific database adapters and temporary compatibility shims only. `apps/wodsmith-start/src/db/schema.ts` and `apps/wodsmith-start/src/db/schemas/*` re-export package schema modules so existing imports keep compiling, but new schema tables and migrations must be added through `packages/wodsmith-db`.

Do not add app-local `drizzle.config.ts` files or `mysqlTable` definitions for the shared WODsmith schema under Start or Crew. Root DB commands, deploy-time schema pushes, and app proxy commands should route through `@repo/wodsmith-db`.
