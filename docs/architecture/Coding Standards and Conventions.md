---
title: Coding Standards and Conventions
type: note
permalink: architecture/coding-standards-and-conventions
---

# Coding Standards and Conventions

## TypeScript Usage
**Mode**: Strict TypeScript enabled
**Patterns**: 
- Prefer interfaces over types
- Avoid enums, use maps instead
- No `any` type usage
- Functional components with TypeScript interfaces

## File Organization
**Naming**: kebab-case for files and folders
**Components**: PascalCase for React components
**Variables/Functions**: camelCase
**Types/Interfaces**: PascalCase, no prefix conventions

## Code Style
**Formatter**: Biome (replaced ESLint)
**Configuration**: `biome.json` with tab indentation
**Imports**: Absolute paths using `@/*` aliases
**Comments**: English only, minimal comments, JSDoc for public APIs

## Server vs Client Components
**Default**: Server Components
**"use client"**: Only when necessary for:
- Web API access
- Interactive state management
- Browser-specific functionality

## Function Parameters
**Pattern**: Named objects for functions with >1 parameter
**Example**: `function createUser({ name, email, teamId })`

## Database Operations
**ORM**: Drizzle ORM exclusively, no direct SQL
**ID Generation**: Never pass id to insert/update operations
**Transactions**: Avoid (D1 doesn't support them)