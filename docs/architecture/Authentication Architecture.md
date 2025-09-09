---
title: Authentication Architecture
type: note
permalink: architecture/authentication-architecture
---

# Authentication Architecture

## Framework Choice: Lucia Auth
**Decision**: Use Lucia Auth for authentication
**Rationale**:
- Lightweight, framework-agnostic
- Excellent TypeScript support
- Session-based with Cloudflare KV storage
- Supports multiple providers (email/password, OAuth)

## Session Management
**Storage**: Cloudflare KV
**Session Structure**: User ID, team context, permissions
**Session Access**:
- Server Components: `getSessionFromCookie()` in `src/utils/auth.ts`
- Client Components: `useSessionStore()` from `src/state/session.ts`

## Multi-tenancy Integration
**Team-based Permissions**: 
- `requireTeamPermission` utility for route protection
- Team switching via team-switcher component
- Session includes current team context

## OAuth Integration
**Providers**: Google SSO implemented
**Location**: `src/lib/sso/google-sso.ts`
**Flow**: OAuth callback handling in `src/app/(auth)/sso/google/`

## Security Patterns
- Password hashing via Lucia Auth
- Session invalidation on logout
- Team-based access control
- Email verification workflow