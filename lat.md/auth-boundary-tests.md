---
lat:
  require-code-mention: true
---
# Account boundary regressions

These tests protect signup and profile validation, supported authentication paths, and verification page navigation.

## Normalized names

Signup and profile saves trim names, accept a single character and retain the 255-character storage limit, including when surrounded by whitespace.

## Invalid names

Blank and oversized names are rejected before profile writes or session refresh, using the same rules at signup.

## Profile authorization

Profile updates require an authenticated user and never change another account based on submitted identity fields.

## Verification redirect cancellation

Leaving ordinary token verification cancels its delayed sign-in redirect, including when the route also supports separate volunteer confirmation codes.

## Late verification completion

A verification request that finishes after unmount cannot schedule a redirect.

## Mounted verification success

Verification runs once under React StrictMode and redirects after the success delay when the page remains mounted.

## Legacy provider recovery

Legacy Google-only records receive the same password error as other passwordless accounts; the existing forgot-password action remains the supported recovery path.

## Password sign-in preservation

A legacy provider id does not affect a verified account's normal password sign-in or session issuance.

## Volunteer name validation

Volunteer account creation rejects blank and oversized names at the server input boundary before account or application side effects.

## Crew legacy provider recovery

Crew treats legacy Google-only records like other passwordless accounts, using existing email-based recovery without an unavailable provider instruction.

## Crew password sign-in preservation

Crew preserves password sign-in for verified accounts that still have a legacy provider id.

## Persisted session method validation

Wodsmith rejects unsupported method tags in older KV records while preserving password/passkey and unspecified legacy sessions without inventing authentication proof.

## Crew persisted session method validation

Crew rejects unsupported persisted method tags while preserving supported or unspecified methods without changing authentication age or inventing proof.

## Unsupported session quota cleanup

Wodsmith excludes unsupported records from the current quota calculation even when KV deletion stays stale. Oldest/newest invalid records cannot evict supported sessions or affect another user.

## Crew unsupported session quota cleanup

Crew excludes oldest/newest unsupported records from the current quota despite stale KV deletion, preserving supported sessions and other users while purging only owned invalid keys.
