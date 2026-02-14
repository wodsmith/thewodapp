# Product Requirements Document: D1 to PlanetScale Migration

## 1. Executive Summary

WODsmith is migrating its database infrastructure from Cloudflare D1 (SQLite-based) to PlanetScale (MySQL/Vitess-based) to address fundamental scalability limitations that will constrain the platform's growth. This migration represents a strategic investment in infrastructure that enables higher write throughput, sophisticated horizontal sharding capabilities, and robust team-based development workflows through PlanetScale's branching model.

The migration is justified by:
- **Current D1 limitations**: Single-region write constraints and lack of native horizontal scaling
- **Growth trajectory**: Competition management features driving increased concurrent write operations during events
- **Developer experience**: Need for isolated development branches and safer schema deployment workflows
- **Future-proofing**: Positioning the platform for multi-tenant scale without architectural rewrites

This is not a simple database swap but an architectural evolution that requires coordinated changes to connectivity patterns, schema design, data access patterns, and operational workflows.

---

## 2. Problem Statement

### 2.1 Write Throughput Constraints

D1's architecture, while excellent for read-heavy edge workloads, presents limitations for WODsmith's competition platform:

- **Single-writer model**: D1's SQLite foundation means write operations are serialized through a single primary
- **Competition events**: Live competition scoring generates bursts of concurrent writes (judges submitting scores, athletes checking in, leaderboards updating)
- **Growing user base**: As more gyms adopt the platform, sustained write throughput becomes a bottleneck

### 2.2 Horizontal Scaling Limitations

- **No native sharding**: D1 cannot horizontally partition data across nodes
- **Storage constraints**: While D1's limits are generous, large-scale multi-tenant deployments will eventually hit ceilings
- **No read replicas**: Cannot distribute read load across multiple database instances

### 2.3 Development Workflow Gaps

- **No branch isolation**: Developers cannot safely test schema changes without affecting shared development databases
- **Manual migration management**: Schema changes require careful coordination and lack automated conflict detection
- **Limited rollback capabilities**: Rolling back failed migrations requires manual intervention

### 2.4 Operational Maturity

- **Query performance visibility**: Limited tooling for identifying slow queries and optimization opportunities
- **Connection management**: D1's binding model doesn't translate to typical database observability patterns

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Description |
|------|-------------|
| Maintain edge performance | P99 database latency within 50ms of current D1 baseline via Hyperdrive |
| Zero data loss | 100% data integrity during migration with verified checksums |
| Enable horizontal scaling | Architecture supports future sharding without code changes |
| Improve developer workflows | Branch-based schema development with Deploy Request model |

### 3.2 Success Metrics

| Metric | Current (D1) | Target (PlanetScale) | Measurement Method |
|--------|--------------|----------------------|-------------------|
| P95 query latency | ~15ms | <50ms | Application metrics |
| Write throughput (sustained) | ~100 writes/sec | >1000 writes/sec | Load testing |
| Schema deployment safety | Manual coordination | Zero-downtime deploys | PlanetScale Deploy Requests |
| Query error rate | <0.1% | <0.1% | Error monitoring |
| Developer branch cycle time | N/A | <5 min to create | PlanetScale metrics |

### 3.3 Non-Functional Requirements

- **Availability**: 99.9% uptime SLA maintained during and after migration
- **Consistency**: Strong consistency for all write-then-read patterns
- **Durability**: Point-in-time recovery capability within 7 days
- **Compliance**: Data residency in US regions maintained

---

## 4. Requirements

### 4.1 Must Have (P0)

These requirements are blocking for production launch.

#### 4.1.1 Hyperdrive Integration

**Requirement**: All database connections must route through Cloudflare Hyperdrive to eliminate TCP/TLS handshake latency.

**Rationale**: Without Hyperdrive, each serverless Worker invocation would incur 200-600ms of connection overhead, causing unacceptable performance regression from D1's sub-10ms baseline.

**Acceptance Criteria**:
- Hyperdrive binding configured in `wrangler.jsonc`
- All Drizzle connections use `env.HYPERDRIVE.connectionString`
- Cold-start database latency <100ms under normal conditions
- Connection pooling verified under load

#### 4.1.2 Schema Conversion (SQLite to MySQL)

**Requirement**: Complete conversion of Drizzle ORM schema from `sqlite-core` to `mysql-core`.

**Rationale**: The two dialects have fundamental differences in type handling, particularly for booleans, integers, and date/time fields.

**Acceptance Criteria**:
- All `integer({ mode: 'boolean' })` converted to `boolean()` (TINYINT)
- All `text()` columns evaluated for appropriate MySQL type (VARCHAR/TEXT)
- All `real()` columns converted to appropriate MySQL numeric type
- All epoch timestamp columns (stored as integers) converted to `datetime` with UTC ISO 8601 format
- Type tests pass with MySQL column definitions

#### 4.1.2.1 Timestamp Format Standardization

**Requirement**: All epoch/integer timestamps must be converted to UTC ISO 8601 datetime format.

**Rationale**:
- Epoch timestamps (Unix integers) are human-unreadable in database tools
- ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`) is the international standard for date interchange
- MySQL's `datetime` type stores in ISO 8601 format natively
- Consistent UTC storage eliminates timezone ambiguity

**Acceptance Criteria**:
- All `integer({ mode: 'timestamp' })` columns converted to `datetime` in MySQL
- All existing epoch values transformed to UTC ISO 8601 during ETL
- Application code updated to work with Date objects instead of Unix integers
- Database queries return proper Date types via Drizzle

#### 4.1.3 ULID Primary Key Adoption

**Requirement**: Replace all auto-increment integer primary keys with ULID-based string keys.

**Rationale**:
- Auto-increment keys cause B-Tree hotspots in distributed systems
- Random UUIDs cause index fragmentation
- ULIDs provide both uniqueness and time-sortability, optimizing insert performance

**Acceptance Criteria**:
- All `id` columns defined as `varchar({ length: 26 })`
- ULID generation configured as default via `$defaultFn(() => ulid())`
- Existing integer IDs migrated to ULID with relationship mapping preserved
- All foreign key references updated to varchar(26)

#### 4.1.4 Cursor-Based Pagination

**Requirement**: Refactor all paginated queries from OFFSET-based to cursor-based pagination.

**Rationale**: OFFSET pagination has O(N) performance degradation in distributed databases. At scale, queries like `LIMIT 10 OFFSET 50000` would consume excessive resources and PlanetScale read quotas.

**Acceptance Criteria**:
- All list endpoints return cursor tokens instead of page numbers
- Tuple comparison syntax implemented for multi-column sort stability
- Frontend components updated to use cursor-based navigation
- No OFFSET clauses remain in production queries

### 4.2 Should Have (P1)

These requirements significantly improve the migration quality but are not blocking.

#### 4.2.1 Query Performance Monitoring

**Requirement**: Implement comprehensive query performance visibility.

**Rationale**: PlanetScale's resource-based pricing penalizes inefficient queries. Proactive monitoring prevents cost overruns and identifies optimization opportunities.

**Acceptance Criteria**:
- Slow query alerting configured (>100ms threshold)
- Dashboard showing query latency distribution
- Index usage monitoring active
- Weekly query review process documented

#### 4.2.2 ETL Migration Pipeline

**Requirement**: Automated, repeatable data migration pipeline from D1 to PlanetScale.

**Rationale**: Manual data migration is error-prone and non-repeatable. An automated pipeline enables testing, validation, and potential re-runs.

**Acceptance Criteria**:
- Programmatic export from D1 (not SQL dump)
- Transform layer handles type conversions and ID mapping
- Bulk insert with progress tracking
- Verification step comparing source and destination row counts/checksums
- Pipeline can be re-run idempotently

### 4.3 Nice to Have (P2)

These requirements enhance the system but can be deferred post-migration.

#### 4.3.1 Read Replica Splitting

**Requirement**: Route read-only queries to PlanetScale read replicas.

**Rationale**: Distributes read load, reduces primary instance resource consumption, and can reduce costs.

**Acceptance Criteria**:
- Hyperdrive configuration supports replica routing
- Critical read paths (post-write) routed to primary
- Analytics/reporting queries routed to replicas
- Metrics show read distribution

#### 4.3.2 Advanced Consistency Patterns

**Requirement**: Implement transactional outbox pattern for event-driven workflows.

**Rationale**: Ensures reliable event publishing when integrating with Cloudflare Queues or external systems.

**Acceptance Criteria**:
- Outbox table for pending events
- Poller service for event dispatch
- At-least-once delivery guarantees
- Dead letter handling for failed events

---

## 5. Non-Goals

The following items are explicitly out of scope for this migration:

| Non-Goal | Rationale |
|----------|-----------|
| Multi-region write distribution | PlanetScale's primary-replica model is sufficient; multi-master adds complexity |
| Database-level foreign key constraints | Vitess FK support complicates schema deployments; application-layer enforcement preferred |
| Real-time replication from D1 | Maintenance window approach is simpler and safer than dual-write |
| GraphQL API layer | Existing REST/RPC patterns sufficient; not a database concern |
| Full-text search migration | Existing search patterns will be evaluated separately |
| Sharding implementation | Architecture enables future sharding, but actual implementation deferred |
| Cost optimization at launch | Focus on correctness first; optimization is a follow-up initiative |

---

## 6. User Stories

### 6.1 Developer Perspective

**As a developer**, I want to create an isolated database branch for my feature work, so that I can test schema changes without affecting other developers or staging environments.

**As a developer**, I want schema changes to deploy with zero downtime, so that I don't have to coordinate maintenance windows for every database change.

**As a developer**, I want to see query performance metrics in a dashboard, so that I can identify and fix slow queries before they impact users.

**As a developer**, I want the migration to preserve all existing functionality, so that I don't need to rewrite business logic.

### 6.2 End-User Perspective

**As a competition organizer**, I want the leaderboard to update in real-time during live events, so that athletes and spectators see current standings without delays.

**As a judge**, I want my score submissions to be recorded immediately, so that I can move efficiently between athletes during heats.

**As an athlete**, I want to view my competition schedule and results without lag, so that I can plan my warm-up and recovery between events.

**As a gym owner**, I want the platform to remain responsive as my membership grows, so that the software doesn't become a bottleneck for my business.

### 6.3 Operations Perspective

**As an operator**, I want automated database backups with point-in-time recovery, so that I can restore data in case of accidental deletion or corruption.

**As an operator**, I want clear visibility into database resource utilization, so that I can make informed decisions about scaling.

**As an operator**, I want the ability to roll back schema changes, so that I can quickly recover from problematic deployments.

---

## 7. Technical Constraints

### 7.1 PlanetScale Platform Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| **Pricing**: Scaler Pro starts at $39/month | Higher baseline cost than D1's usage-based model | Query optimization to minimize resource consumption |
| **Foreign Keys**: Vitess FK support complicates deploys | Cannot rely on database-level referential integrity | Enforce relationships in application layer with Drizzle relations |
| **No Transactions Across Shards** | Multi-shard transactions not atomic | Design data access patterns to avoid cross-shard operations |
| **MySQL 8.0 Syntax** | Some SQLite idioms don't translate | Audit all raw SQL for MySQL compatibility |

### 7.2 Cloudflare Workers Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| **No persistent connections** | Every request potentially cold-starts | Hyperdrive connection pooling |
| **SubtleCrypto async-only** | Some libraries assume sync crypto | Use async variants (e.g., `constructEventAsync` for Stripe) |
| **Request duration limits** | Long-running migrations timeout | Batch operations with continuation tokens |

### 7.3 Data Migration Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| **No live replication** | Requires maintenance window | Schedule during low-traffic period |
| **ID format change** | All integer IDs become ULIDs | Build comprehensive ID mapping during ETL |
| **Type coercion** | SQLite's loose typing vs MySQL strict | Explicit transform layer in ETL pipeline |

---

## 8. Risks & Mitigations

### 8.1 High Severity Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Latency regression** | Medium | High | Hyperdrive integration mandatory; extensive load testing before cutover |
| **Data loss during migration** | Low | Critical | Checksums, row count verification, maintenance mode during cutover |
| **Schema conversion errors** | Medium | High | Comprehensive test suite run against MySQL before migration |

### 8.2 Medium Severity Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Cost overruns** | Medium | Medium | Query monitoring from day one; budget alerts configured |
| **ID mapping failures** | Low | High | Exhaustive relationship graph validation in ETL |
| **Raw SQL incompatibilities** | Medium | Medium | Audit all `sql` template tag usage for dialect differences |

### 8.3 Low Severity Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Team workflow adoption** | Low | Low | Documentation and training on Deploy Request model |
| **Hyperdrive availability** | Low | Medium | Circuit breaker pattern; fallback connection option |

---

## 9. Timeline Milestones

The following phases are ordered by dependency. Time estimates will be determined during implementation planning.

### Phase 1: Foundation

- [ ] Provision PlanetScale Scaler Pro instance
- [ ] Configure Hyperdrive binding in development
- [ ] Establish connection from Workers to PlanetScale via Hyperdrive
- [ ] Verify basic query execution

### Phase 2: Schema Conversion

- [ ] Convert Drizzle schema from sqlite-core to mysql-core
- [ ] Implement ULID generation for all primary keys
- [ ] Update all foreign key definitions to varchar(26)
- [ ] Resolve all TypeScript type errors
- [ ] Generate initial MySQL schema in PlanetScale

### Phase 3: Data Access Refactoring

- [ ] Audit and convert all OFFSET pagination to cursor-based
- [ ] Update frontend components for cursor pagination
- [ ] Audit raw SQL for MySQL compatibility
- [ ] Update date/time handling functions
- [ ] Fix string concatenation operators

### Phase 4: ETL Pipeline Development

- [ ] Build D1 data export utility
- [ ] Implement transform layer (types, IDs)
- [ ] Build PlanetScale bulk loader
- [ ] Create verification/checksum tooling
- [ ] Test pipeline with production data snapshot

### Phase 5: Testing & Validation

- [ ] Execute full test suite against PlanetScale
- [ ] Perform load testing with realistic traffic patterns
- [ ] Validate Hyperdrive performance under load
- [ ] Conduct failover and recovery testing
- [ ] Complete security review of new architecture

### Phase 6: Production Migration

- [ ] Announce maintenance window to users
- [ ] Enable maintenance mode
- [ ] Execute ETL pipeline
- [ ] Verify data integrity
- [ ] Deploy PlanetScale-enabled application
- [ ] Validate core user flows
- [ ] Disable maintenance mode
- [ ] Monitor for issues

### Phase 7: Post-Migration

- [ ] Decommission D1 database (after stability period)
- [ ] Configure query performance monitoring
- [ ] Document new development workflows
- [ ] Retrospective and lessons learned

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **D1** | Cloudflare's serverless SQLite database |
| **PlanetScale** | Serverless MySQL platform built on Vitess |
| **Vitess** | Open-source database clustering system for horizontal scaling of MySQL |
| **Hyperdrive** | Cloudflare's database connection pooling and caching service |
| **ULID** | Universally Unique Lexicographically Sortable Identifier |
| **Drizzle ORM** | TypeScript ORM used in WODsmith |
| **ETL** | Extract-Transform-Load data migration pattern |
| **Deploy Request** | PlanetScale's safe schema change workflow |

## Appendix B: Related Documents

- Research Document: `/docs/research/d1-to-planetscale.md`
- Database Schema: `/apps/wodsmith-start/src/db/schema.ts`
- Project Architecture: `/docs/project-plan.md`

---

*Document Version: 1.0*
*Last Updated: January 2026*
