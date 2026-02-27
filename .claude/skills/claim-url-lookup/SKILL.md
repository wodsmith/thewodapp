---
name: claim-url-lookup
description: Look up claim URLs for placeholder users created via manual registration. Use when needing to find the sign-up claim link for a specific email address, debug claim token issues, or verify claim tokens exist in local KV. Triggers on "claim URL", "claim token", "claim link", "placeholder user sign-up link", or requests to find the registration invite link for an email.
---

# Claim URL Lookup

Look up the claim URL for a placeholder user by email address.

## Process

### 1. Find the user ID via PlanetScale

Query the `users` table on the appropriate branch (usually `dev`) using the PlanetScale MCP tool:

```sql
SELECT id, email FROM users WHERE email = '<email>'
```

Use `mcp__planetscale__planetscale_execute_read_query` with:
- organization: `wodsmith`
- database: `wodsmith-db`
- branch: `dev` (or whichever branch is relevant)

### 2. Query local KV for claim tokens

The KV SQLite database is at:

```
apps/wodsmith-start/.alchemy/local/.wrangler/state/v3/kv/miniflare-KVNamespaceObject/f35c41ba47d70351a0716642bf2c0bfea862895102f4c8ac3bc512bfca72c8d4.sqlite
```

Query for all claim tokens:

```sql
sqlite3 "<path-to-kv-sqlite>" "SELECT key, blob_id FROM _mf_entries WHERE key LIKE 'claim-token:%';"
```

This returns rows like: `claim-token:<token>|<blob_id>`

### 3. Read blob files to match userId

Blob files are stored at:

```
apps/wodsmith-start/.alchemy/local/.wrangler/state/v3/kv/e971afc3bbb149bd93cbd5a4f993869a/blobs/<blob_id>
```

Each blob contains JSON: `{"userId":"usr_...","expiresAt":"..."}`.

Read each blob file and find the one whose `userId` matches the user from step 1.

### 4. Construct the claim URL

The claim URL format is:

```
{APP_URL}/sign-up?claim=<token>
```

Where `<token>` is the portion after `claim-token:` in the KV key.

## Key files

- Token generation: `src/utils/auth-utils.ts` — `createToken` (CUID2 length 32), `getClaimTokenKey`
- Token storage: `src/server-fns/registration-fns.ts` — stores in KV at registration time with 90-day TTL
- URL construction: `src/server/registration.ts` — builds `{getSiteUrl()}/sign-up?claim={token}`
- Sign-up consumption: `src/server-fns/auth-fns.ts` — validates and consumes claim token during sign-up
