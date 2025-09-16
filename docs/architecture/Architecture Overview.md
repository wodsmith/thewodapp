---
title: Architecture Overview
type: note
permalink: architecture/architecture-overview
---

# TheWodApp Architecture Overview

## Project Type
SaaS workout management platform for CrossFit gyms and teams

## Core Technology Stack
- **Frontend**: Next.js 15.3.2 (App Router), React 19, TypeScript 5.x
- **UI**: Tailwind CSS v4, Shadcn UI, Radix UI primitives
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM
- **Authentication**: Lucia Auth with Cloudflare KV sessions
- **Deployment**: Cloudflare Workers with OpenNext
- **State Management**: Zustand (client), React Context, Server Components
- **API**: REST via Next.js API Routes, Server Actions with zsa

## Key Architectural Principles
1. **Server-first architecture** - Leverage Next.js App Router and Server Components
2. **Type-safety throughout** - TypeScript, Zod, Drizzle ORM
3. **Multi-tenancy** - Team-based isolation with role-based permissions
4. **Edge deployment** - Cloudflare Workers for global performance
5. **Strict TypeScript** - No `any` types, enforced by Biome linting

## Project Structure
- `src/app/` - Next.js App Router with route groups
- `src/components/` - Reusable UI components by feature
- `src/db/` - Database schema and Drizzle configuration
- `src/server/` - Business logic services
- `src/actions/` - Server actions for client-server communication
- `src/utils/` - Shared utilities including auth and team management

## Multi-tenancy Strategy
- Team-based data isolation
- Role-based access control (admin, member)
- Team switching via team-switcher component
- All database queries filter by teamId