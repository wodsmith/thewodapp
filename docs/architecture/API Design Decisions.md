---
title: API Design Decisions
type: note
permalink: architecture/api-design-decisions
---

# API Design Decisions

## Server Actions with zsa
**Decision**: Use zsa for type-safe server actions
**Benefits**:
- TypeScript-first approach
- Automatic type inference
- Built-in error handling
- Progressive enhancement

## API Structure
**Pattern**: RESTful via Next.js API Routes
**Location**: `src/app/api/` for traditional REST endpoints
**Server Actions**: `src/actions/` for form submissions and mutations

## Error Handling Strategy
**Pattern**: Structured error responses
**Implementation**: zsa provides consistent error handling
**Client Handling**: Type-safe error handling with discriminated unions

## Data Validation
**Framework**: Zod schemas
**Location**: `src/schemas/` for reusable validation schemas
**Integration**: React Hook Form with @hookform/resolvers

## Authentication Integration
**Pattern**: Session-based authentication
**Protection**: `requireTeamPermission` utility
**Team Context**: All actions include team validation

## Type Safety
**Goal**: End-to-end type safety
**Tools**: TypeScript, Zod, Drizzle ORM
**Result**: Compile-time type checking for all data flows