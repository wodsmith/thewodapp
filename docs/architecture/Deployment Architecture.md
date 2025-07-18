---
title: Deployment Architecture
type: note
permalink: architecture/deployment-architecture
---

# Deployment Architecture

## Platform: Cloudflare Workers
**Decision**: Deploy on Cloudflare Workers for global edge deployment
**Benefits**:
- Global edge network for low latency
- Serverless scaling
- Integrated with D1 database and KV storage
- Cost-effective for SaaS applications

## Build Process
**Framework**: OpenNext for Next.js to Cloudflare Workers
**Commands**:
- `pnpm build` - Development build
- `pnpm opennext:build` - Production build for Cloudflare

## Infrastructure Services
**Database**: Cloudflare D1 (SQLite)
**Session Storage**: Cloudflare KV
**File Storage**: Cloudflare R2 (when needed)
**AI Services**: Cloudflare AI (when needed)

## Environment Configuration
**File**: `wrangler.jsonc` for Cloudflare configuration
**Type Generation**: `pnpm run cf-typegen` after adding new primitives
**Environment Variables**: Managed through Cloudflare dashboard

## Development Workflow
**Local Development**: `pnpm dev` with Next.js dev server
**Database**: Local D1 for development
**Deployment**: GitHub Actions to Cloudflare Workers
**Monitoring**: Cloudflare Analytics and logging