---
lat:
  require-code-mention: true
---
# Volunteer email confirmation

Anonymous volunteers confirm their saved application through a mailbox-delivered link before identity or application changes. A typed email or public URL parameter is never ownership proof.

[[apps/wodsmith-start/src/server-fns/volunteer-fns.ts#createAccountAndApplyAsVolunteerFn]] stores application fields and a server-derived competition return path in [[packages/wodsmith-db/src/schemas/volunteer-signup-intents.ts#volunteerSignupIntentsTable]]. It emails an unreturned random code, saves only its SHA-256 hash, and expires it after 30 minutes. Passwords from older clients are discarded. No users, memberships, applications, answers, or waiver signatures are created before proof.

[[apps/wodsmith-start/src/server-fns/volunteer-fns.ts#confirmVolunteerSignupFn]] consumes the code with a row lock and completes verification, credential clearing, waiver signing, and application creation in the same transaction. The intent binds purpose, account ID, email, application, and return path. Its consumed record survives application deletion. Account locks with READ COMMITTED serialize different confirmation links and direct submissions without stale duplicate-check snapshots.

Existing verified credentials remain unchanged. Existing unverified passwords and passkeys are removed so attacker-preseeded credentials cannot become usable; new accounts are passwordless. After commit the existing revocation helper invalidates old authentication, then an email-link session is issued. KV revocation retains its documented propagation limits from [[auth#Authentication#Sessions#Password recovery revocation]]. If revocation or session issuance fails, the application stays saved and the token stays consumed; no session is issued by a failed revocation. The user can use password recovery to regain access. Later password setup is optional and uses the existing mailbox recovery flow.

The browser keeps all application details on the server and asks only for the emailed click. Required waivers are rechecked at completion; changed requirements can fail without consuming proof. Existing verified signed-in users apply directly, and both session and current database email must match the application.

Migration `0008_volunteer_signup_intents` depends on `0007_transfer_signature_name` from PR #695. Its generated snapshot preserves that signature column and adds only the intent table. No production migration is performed by tests.

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
