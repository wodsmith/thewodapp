---
lat:
  require-code-mention: true
---

# Shared Application Core Guardrail Tests

These tests keep the shared package client-safe, make its cross-app scan cache-correct, and preserve useful receipt typing during vertical-slice migrations.

## Transitive Client Export Traversal

The boundary guard follows local re-exports from public client-safe entry points and reports a forbidden import reached through an intermediate module.

## Bare Node Built-In Rejection

The boundary predicates reject both `node:` imports and bare Node built-in specifiers without confusing similarly named packages.

## Database Package Boundary Rejection

The boundary predicates reject the exact database workspace package and all of its subpaths while avoiding substring-based false positives.

## Sibling Server Module Rejection

The server-function guard rejects sibling modules whose basename ends in `.server`, including imports that omit the source extension.

## Turbo Boundary Input Coverage

The shared-package test hash includes guard scripts, manifests, and the Crew and Start server-function trees inspected by those guards.

## Fixed-Shape Operation Receipt Identifiers

An operation receipt accepts a named aggregate-ID interface whose declared properties are strings or null without requiring a string index signature.
