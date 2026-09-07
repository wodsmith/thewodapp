---
lat:
  require-code-mention: true
---
# Volunteer email confirmation

Anonymous volunteers confirm their saved application through a mailbox-delivered link before identity or application changes. A typed email or public URL parameter is never ownership proof.

[[apps/wodsmith-start/src/server-fns/volunteer-fns.ts#createAccountAndApplyAsVolunteerFn]] stores application fields and a server-derived competition return path in [[packages/wodsmith-db/src/schemas/volunteer-signup-intents.ts#volunteerSignupIntentsTable]]. It emails an unreturned random code, saves only its SHA-256 hash, and expires it after 30 minutes. Passwords from older clients are discarded. No users, memberships, applications, answers, or waiver signatures are created before proof.

[[apps/wodsmith-start/src/server-fns/volunteer-fns.ts#confirmVolunteerSignupFn]] consumes the code with a row lock and completes verification, credential clearing, waiver signing, and application creation in the same transaction. The intent binds purpose, account ID, email, application, and return path. Its consumed record survives application deletion. Account locks with READ COMMITTED serialize different confirmation links and direct submissions without stale duplicate-check snapshots.

Existing verified credentials remain unchanged. Existing unverified passwords and passkeys are removed; new accounts are passwordless. The same transaction increments `users.authGeneration` for an existing unverified account. Its lifetime is independent of intents, applications, and KV. Both Wodsmith and Crew validate the session's original proof generation against this authoritative database value before trusting cached user data. Missing legacy generations mean zero, which is accepted only while the account remains at zero. Timestamps cannot cross this boundary.

Browser/password and bearer issuance bind the generation read with credential proof. Session creation rejects stale generations; bearer rotation and profile refresh preserve the original generation, and refresh rechecks after loading user data. The mailbox session uses the transaction's committed generation. KV revocation remains defense in depth; failure leaves the application and proof committed but issues no new session. Password recovery remains available.

Security validation adds one primary-key database read per session validation, plus a recheck during profile refresh and issuance. Both applications configure Hyperdrive with caching disabled; this setting is required for authoritative security reads. Database errors fail closed. Per-request memoization still avoids duplicate validation in one request. Confirmation clears its account's request cache even on KV failure. Other requests already authorized before the transaction can finish ordinary reads/profile responses using their old snapshot; this does not retroactively cancel in-flight work or promote that snapshot to a verified identity. Subsequent requests revalidate.

Existing-account signup writes atomically require the original generation plus an unverified, passwordless account. Reset writes require the original generation. There is no active session-authenticated password/email-change or passkey-create endpoint; unused WebAuthn helpers have no runtime callers. Passkey management only lists/deletes. Verification/reset tokens are sent only to the mailbox and never returned to the requester.

Crew's unused `createAccountAndApplyAsVolunteerFn` export is removed, preventing the copied anonymous credential-upgrade path from being exposed. The active `/e/$slug/volunteer`, confirmation, and schedule routes continue through `crew-volunteer-fns` and its token-scoped server implementation.

The browser keeps all application details on the server and asks only for the emailed click. Required waivers are rechecked at completion; changed requirements can fail without consuming proof. Existing verified signed-in users apply directly, and both session and current database email must match the application.

Migration `0008_volunteer_signup_intents` depends on `0007_transfer_signature_name` from PR #695. Its generated snapshot preserves that signature column and adds the intent table and the durable account generation column. Deploy this additive migration before either application’s authentication code; older code can still use existing accounts with the default generation zero. The security fix requires deployment of both validators. No production migration is performed by tests.

## No premature identity changes

Submitting an anonymous application for existing verified or unverified accounts stores only a hashed confirmation intent, with no password, application, waiver, membership, or session changes.

## Unverified credential takeover

Mailbox confirmation clears attacker-preseeded passwords and passkeys, revokes existing sessions, and only then issues an email-link session.

## Verified credential preservation

Confirmation preserves existing verified credentials and persists every saved answer, availability field, contact detail, and waiver agreement with the correct return context.

## New account proof

New accounts are absent before mailbox proof and become verified passwordless accounts only when the emailed code is redeemed.

## Atomic concurrent redemption

Only one concurrent request can redeem a code. Deleting the completed application cannot make that consumed proof reusable.

## Concurrent application intents

Distinct links for the same account and competition serialize so only one application and one session are created.

## Invalid confirmation proofs

Expired, unknown, wrong-purpose, wrong-email, and wrong-account proofs fail without altering credentials or creating applications or sessions.

## Concurrent new identities

Two new-account intents racing on one email create exactly one identity and application; the unique email and bound account ID prevent takeover by the losing intent.

## Session failure boundary

A revocation failure after completion issues no email-link session. The application remains saved and proof remains consumed, with password recovery available for access.

## Different signed-in identity

A different signed-in account cannot redeem the mailbox owner's link; the failed attempt leaves proof available for its rightful owner.

## Atomic completion rollback

An application failure rolls back verification, credential clearing, and token consumption, preserving a retry after the failure is resolved.

## Verified direct application

Verified account owners can submit directly without an email step. Forged application emails and unverified sessions are rejected.

## Saved signup form

The browser sends all entered application fields and agreements once, requests no password, and displays a truthful pending-confirmation state without asking for re-entry.

## One-click confirmation screen

The emailed code is redeemed once under React StrictMode, then the screen confirms completion and links to the server-provided competition context without a form.

## Confirmation navigation cancellation

A confirmation finishing after unmount cannot navigate the user away from their new page.

## Direct signup screen

An already signed-in volunteer retains a single direct submit and sees immediate application success, without an email-confirmation request.

## Confirmation email content

The reused email template explains saved application submission and its 30-minute expiry, while ordinary verification emails retain their existing action and wording.

## Durable cross-app session revocation

Stale Wodsmith browser, bearer, and Crew sessions cannot mutate a claimed account even when KV revocation fails; deleting consumed intents cannot restore them.

## Proof generation and legacy sessions

Delayed old password/passkey proof and legacy sessions cannot cross a claim. The mailbox owner can authenticate in the same millisecond using the committed generation.

## Password proof issuance race

Browser and bearer credential adapters preserve the generation read with password proof, rejecting issuance if the account changes before session creation while permitting fresh owner login.

## Bearer generation rotation

Bearer rotation preserves proof generation and authentication age; a claim during validation cannot mint current-generation authentication from old proof.

## Profile refresh generation race

A profile refresh that overlaps an identity claim must reject before returning newly verified user data under the old session's proof.

## Confirmation request cache boundary

Confirmation clears the claiming account's memoized session even when KV revocation fails, and subsequent request scopes revalidate the durable generation.

## Crew credential proof race

Crew password login rejects delayed proof from a previous account generation and accepts a fresh credential proof at the current generation.

## Crew profile refresh race

Crew profile refresh preserves the original proof generation and rejects changes that occur while loading shared account data.

## Additive migration deployment boundary

The additive generation column preserves existing accounts with a zero default. New validation fails closed before that column exists, requiring migration before application deployment.

## Crew public token boundary

The unused copied account-upgrade endpoint is absent, while the active Crew schedule endpoint still serves a valid volunteer token without changing account credentials.

## Credential mutation claim race

Both apps' signup, claim-link upgrade, and reset endpoints reject credential writes if confirmation commits after their original account read. Conditional writes prevent an in-flight request from restoring attacker credentials.

## New signup mailbox boundary

Generic signup in both apps creates an unverified account, emails verification proof, and issues no session. Anonymous input cannot manufacture the verified-existing status that volunteer confirmation preserves.
