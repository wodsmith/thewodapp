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

Leaving the successful verification page cancels its delayed sign-in redirect so it cannot override later navigation.

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
