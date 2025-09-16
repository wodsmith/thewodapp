---
title: Database Architecture Decisions
type: note
permalink: architecture/database-architecture-decisions
---

# Database Architecture Decisions

## Database Choice: Cloudflare D1 (SQLite)
**Decision**: Use Cloudflare D1 with SQLite for the primary database
**Rationale**: 
- Serverless SQL database that scales with Cloudflare Workers
- Global edge deployment for low latency
- Familiar SQL syntax with Drizzle ORM
- Cost-effective for SaaS applications

## Schema Design Patterns
**Common Columns Pattern**: All entities include:
- `id` (CUID2 with prefixes: team_, user_, workout_)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `updateCounter` (for optimistic locking)

## Multi-tenancy Strategy
**Decision**: Team-based isolation at the application level
**Implementation**:
- All queries filter by `teamId`
- No database-level tenant isolation
- Team switching handled in application layer
- Role-based permissions per team

## Migration Strategy
**Decision**: Use Drizzle ORM migrations
**Process**:
- `pnpm db:generate [MIGRATION_NAME]` to create migrations
- `pnpm db:migrate:dev` to apply migrations
- No manual SQL migration files

## Transaction Handling
**Decision**: Avoid Drizzle ORM transactions
**Rationale**: Cloudflare D1 doesn't support transactions
**Alternative**: Use application-level consistency patterns