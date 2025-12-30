# Authentication Routes & Actions - TanStack Start Migration Status

## Overview

This document catalogs all authentication routes in the Next.js app (apps/wodsmith) and tracks their migration status to TanStack Start (apps/wodsmith-start).

**Source:** `apps/wodsmith/src/app/(auth)/`  
**Target:** `apps/wodsmith-start/src/routes/_auth/`

---

## Migration Status Summary

| Category | Total | ✅ Migrated | 🔄 Partial | ❌ Not Started |
|----------|-------|-------------|-----------|----------------|
| Routes | 8 | 2 | 0 | 6 |
| Actions | 10 | 2 | 0 | 8 |
| Tests (E2E) | 8 | 8 | 0 | 0 |
| Tests (Integration) | 10 | 0 | 0 | 10 |

---

## Step 0: Test Requirements

Before migrating auth routes, we need test coverage to ensure functional parity between Next.js and TanStack implementations.

### Testing Trophy Strategy

```
       /\
      /  \  E2E (8 tests exist)
     /----\  sign-in, logout, session persistence
    / INT  \ Integration (0 tests - PRIORITY)
   /--------\ Actions: forgot-password, reset-password, verify-email, etc.
  |  UNIT  | Unit (Validators, pure functions)
  |________| password validation, email validation, token generation
   STATIC   TypeScript + Biome linting
```

### Existing Test Coverage

#### E2E Tests (Playwright) ✅ Complete for P0

| Test File | Tests | Coverage | Status |
|-----------|-------|----------|--------|
| `e2e/auth.spec.ts` | 8 | Sign-in flows, logout, session | ✅ Exists |
| `e2e/fixtures/auth.ts` | N/A | Auth helper functions | ✅ Exists |

**Covered Scenarios:**
- ✅ Login page display
- ✅ Unauthenticated redirect to /sign-in
- ✅ Valid test user login
- ✅ Admin user login
- ✅ Invalid credentials error
- ✅ Non-existent user error
- ✅ Logout flow
- ✅ Session persistence across navigation

**Missing E2E:**
- ❌ Sign-up flow (user creation)
- ❌ Forgot password → reset password flow
- ❌ Email verification flow
- ❌ Google OAuth flow (may need mock)
- ❌ Team invite acceptance

#### Integration Tests ❌ Missing

| Action | Test File | Status | Priority |
|--------|-----------|--------|----------|
| `signInAction` | N/A | ❌ Missing | P1 |
| `signUpAction` | N/A | ❌ Missing | P1 |
| `forgotPasswordAction` | N/A | ❌ Missing | P1 |
| `resetPasswordAction` | N/A | ❌ Missing | P1 |
| `verifyEmailAction` | N/A | ❌ Missing | P2 |
| `resendVerificationAction` | N/A | ❌ Missing | P2 |
| `googleSSOCallbackAction` | N/A | ❌ Missing | P2 |
| `acceptTeamInviteAction` | N/A | ❌ Missing | P2 |
| `startPasskeyRegistrationAction` | N/A | ❌ Missing | P3 |
| `completePasskeyRegistrationAction` | N/A | ❌ Missing | P3 |

#### Unit Tests ❌ Missing

| Utility | Test File | Status | Priority |
|---------|-----------|--------|----------|
| `hashPassword` / `verifyPassword` | N/A | ❌ Missing | P1 |
| `canSignUp` (disposable email) | N/A | ❌ Missing | P1 |
| `getVerificationTokenKey` | N/A | ❌ Missing | P2 |
| `getResetTokenKey` | N/A | ❌ Missing | P2 |
| `validateTurnstileToken` | N/A | ❌ Missing | P2 |
| Password validation schemas | N/A | ❌ Missing | P1 |

### Test Requirements by Route

#### P0 - Critical Path (E2E Required)

| Route | E2E Tests | Integration Tests | Unit Tests | Notes |
|-------|-----------|-------------------|------------|-------|
| Sign In | ✅ 6 tests in auth.spec.ts | ❌ Need `signInAction` test | ❌ Need password verification | E2E sufficient for migration |
| Sign Up | ❌ Missing | ❌ Need `signUpAction` test | ❌ Need password hashing, email validation | **BLOCKER**: Need at least integration |

#### P1 - Password Management (Integration Required)

| Route | E2E Tests | Integration Tests | Unit Tests | Notes |
|-------|-----------|-------------------|------------|-------|
| Forgot Password | ❌ Missing | ❌ Need `forgotPasswordAction` | ❌ Token generation | KV + email mocking required |
| Reset Password | ❌ Missing | ❌ Need `resetPasswordAction` | ❌ Token validation | KV mocking required |

#### P2 - Email & OAuth (Integration Required)

| Route | E2E Tests | Integration Tests | Unit Tests | Notes |
|-------|-----------|-------------------|------------|-------|
| Verify Email | ❌ Missing | ❌ Need `verifyEmailAction` | ❌ Token validation | KV + session update mocking |
| Google OAuth | ❌ Difficult to E2E | ❌ Need `googleSSOCallbackAction` | ❌ OAuth state validation | Mock Arctic library |
| Team Invite | ❌ Missing | ❌ Need `acceptTeamInviteAction` | N/A | Session + team service mocking |

#### P3 - Advanced Features (Integration Required)

| Route | E2E Tests | Integration Tests | Unit Tests | Notes |
|-------|-----------|-------------------|------------|-------|
| Passkey | ❌ Complex | ❌ Need WebAuthn actions | ❌ Challenge generation | WebAuthn mocking complex |

### Recommended Test Creation Order

1. **Create integration tests for migrated routes first:**
   - `test/actions/sign-in-actions.test.ts` - Test `signInAction`
   - `test/actions/sign-up-actions.test.ts` - Test `signUpAction`

2. **Add unit tests for shared utilities:**
   - `test/utils/password-hasher.test.ts`
   - `test/utils/auth-validators.test.ts`

3. **Add integration tests for P1 routes (before migration):**
   - `test/actions/forgot-password-actions.test.ts`
   - `test/actions/reset-password-actions.test.ts`

4. **Create E2E for sign-up flow:**
   - Add to `e2e/auth.spec.ts` - user registration test

### Test Mocking Strategy

| Dependency | Mock Approach | Test Utility |
|------------|---------------|--------------|
| Database (D1) | Use test database with fixtures | `test/setup.ts` |
| KV Store | Mock Cloudflare KV | Custom mock in `test/__mocks__/` |
| Email (Resend) | Mock API calls | `vi.mock()` |
| Session | Mock `getSessionFromCookie` | Already in other tests |
| OAuth (Arctic) | Mock Google client | `vi.mock()` |
| Turnstile | Mock validation | `vi.mock()` |

### Migration Test Checklist

For each route migration, verify:

- [ ] Existing E2E tests pass against TanStack implementation
- [ ] Integration tests written for server functions
- [ ] Unit tests written for extracted utilities
- [ ] Error handling matches Next.js behavior
- [ ] Rate limiting behavior verified (manual or integration)
- [ ] Session management works correctly

---

## Core Authentication Routes

### Sign In

| Route | Next.js Path | TanStack Path | Status | Components | Actions | Tests | Notes |
|-------|-------------|---------------|--------|------------|---------|-------|-------|
| Sign In | `/sign-in` | `/_auth/sign-in` | ✅ Migrated | `sign-in.client.tsx`, `page.tsx` | `signInAction` | ✅ E2E (6), ❌ Integration, ❌ Unit | Core functionality migrated. Missing: SSO buttons, passkey auth |

**Next.js Implementation:**
- **Route**: `apps/wodsmith/src/app/(auth)/sign-in/`
- **Components**: 
  - `page.tsx` - Server component wrapper
  - `sign-in.client.tsx` - Client form component
- **Actions**: 
  - `sign-in.actions.ts` - `signInAction` (email/password authentication)
- **Features**:
  - Email/password authentication
  - SSO buttons (Google OAuth)
  - Passkey authentication option
  - Rate limiting (RATE_LIMITS.SIGN_IN)
  - Error handling for SSO-only accounts
  - PostHog analytics tracking

**TanStack Implementation:**
- **Route**: `apps/wodsmith-start/src/routes/_auth/sign-in.tsx`
- **Server Functions**:
  - `signInServerFn` - Email/password authentication (replaces `signInAction`)
  - `getSessionServerFn` - Session check in `beforeLoad`
- **Migrated Features**:
  - ✅ Email/password authentication
  - ✅ Form validation with Zod
  - ✅ Error handling
  - ✅ Redirect after sign-in
  - ✅ SSO-only account detection
- **Missing Features**:
  - ❌ SSO buttons (Google OAuth)
  - ❌ Passkey authentication
  - ❌ Rate limiting
  - ❌ PostHog analytics
  - ❌ Turnstile captcha

**Migration Notes:**
- TanStack Start uses `createServerFn` instead of ZSA `createServerAction`
- Error handling is simpler (throws Error instead of ZSAError)
- No rate limiting wrapper yet
- Session check in `beforeLoad` needs proper implementation (currently returns null)

---

### Sign Up

| Route | Next.js Path | TanStack Path | Status | Components | Actions | Tests | Notes |
|-------|-------------|---------------|--------|------------|---------|-------|-------|
| Sign Up | `/sign-up` | `/_auth/sign-up` | ✅ Migrated | `sign-up.client.tsx`, `page.tsx` | `signUpAction`, `startPasskeyRegistrationAction`, `completePasskeyRegistrationAction` | ❌ E2E, ❌ Integration, ❌ Unit | Core functionality migrated. Missing: SSO, passkey, captcha, email verification, invite processing |

**Next.js Implementation:**
- **Route**: `apps/wodsmith/src/app/(auth)/sign-up/`
- **Components**:
  - `page.tsx` - Server component wrapper
  - `sign-up.client.tsx` - Client form component
- **Actions**:
  - `sign-up.actions.ts` - `signUpAction` (email/password registration)
  - `passkey-sign-up.actions.ts` - Passkey registration flow:
    - `startPasskeyRegistrationAction` - Initiates WebAuthn registration
    - `completePasskeyRegistrationAction` - Verifies and stores passkey
- **Features**:
  - Email/password registration
  - SSO buttons (Google OAuth)
  - Passkey registration (WebAuthn)
  - Turnstile captcha validation
  - Auto-verify email on signup
  - Personal team creation
  - Approved invitation processing
  - Rate limiting
  - PostHog analytics

**TanStack Implementation:**
- **Route**: `apps/wodsmith-start/src/routes/_auth/sign-up.tsx`
- **Server Functions**:
  - `signUpServerFn` - Email/password registration (replaces `signUpAction`)
  - `getSessionServerFn` - Session check in `beforeLoad`
- **Migrated Features**:
  - ✅ Email/password registration
  - ✅ Form validation with Zod
  - ✅ Email uniqueness check
  - ✅ Password hashing
  - ✅ Auto-verify email on signup
  - ✅ Personal team creation (inlined logic)
  - ✅ Session creation
  - ✅ Redirect after sign-up
- **Missing Features**:
  - ❌ SSO buttons (Google OAuth)
  - ❌ Passkey registration (WebAuthn)
  - ❌ Turnstile captcha
  - ✅ Disposable email checking (`canSignUp`) - **MIGRATED** (line 51 in sign-up.tsx)
  - ❌ Approved invitation processing
  - ❌ Rate limiting
  - ❌ PostHog analytics
  - ❌ IP address tracking (`signUpIpAddress`)
  - ❌ Error logging with PostHog/OpenTelemetry

**Migration Notes:**
- Personal team creation is inlined in TanStack version instead of using `createPersonalTeamForUser` helper
- Missing `processApprovedInvitationsForEmail` call
- No IP address tracking yet
- Session check needs proper implementation

---

## Password Management Routes

### Forgot Password

| Route | Next.js Path | TanStack Path | Status | Components | Actions | Tests | Notes |
|-------|-------------|---------------|--------|------------|---------|-------|-------|
| Forgot Password | `/forgot-password` | N/A | ❌ Not Started | `forgot-password.client.tsx`, `page.tsx` | `forgotPasswordAction` | ❌ E2E, ❌ Integration, ❌ Unit | Generates reset token, sends email |

**Next.js Implementation:**
- **Route**: `apps/wodsmith/src/app/(auth)/forgot-password/`
- **Components**:
  - `page.tsx` - Server component wrapper
  - `forgot-password.client.tsx` - Client form component
- **Actions**:
  - `forgot-password.action.ts` - `forgotPasswordAction`
- **Features**:
  - Email input with validation
  - Turnstile captcha validation
  - Password reset token generation (32-char CUID2)
  - Token storage in KV with TTL (PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS)
  - Password reset email sending
  - Email enumeration prevention (always returns success)
  - Rate limiting (RATE_LIMITS.FORGOT_PASSWORD)
  - Error handling

**TanStack Migration Needed:**
- Create `apps/wodsmith-start/src/routes/_auth/forgot-password.tsx`
- Convert `forgotPasswordAction` to `createServerFn`
- Implement Turnstile captcha
- Implement rate limiting
- Add email sending

**Dependencies:**
- KV store access (Cloudflare)
- Email service (Resend)
- Turnstile captcha
- `canSignUp` utility (disposable email check)

---

### Reset Password

| Route | Next.js Path | TanStack Path | Status | Components | Actions | Tests | Notes |
|-------|-------------|---------------|--------|------------|---------|-------|-------|
| Reset Password | `/reset-password?token=...` | N/A | ❌ Not Started | `reset-password.client.tsx`, `page.tsx`, `not-found.tsx` | `resetPasswordAction` | ❌ E2E, ❌ Integration, ❌ Unit | Validates token, updates password |

**Next.js Implementation:**
- **Route**: `apps/wodsmith/src/app/(auth)/reset-password/`
- **Components**:
  - `page.tsx` - Server component wrapper (validates token exists)
  - `reset-password.client.tsx` - Client form component
  - `not-found.tsx` - Custom 404 for missing token
- **Actions**:
  - `reset-password.action.ts` - `resetPasswordAction`
- **Features**:
  - Token validation from URL query param
  - Token lookup in KV store
  - Token expiration check
  - Password validation (Zod schema)
  - Password hashing
  - User lookup and update
  - Token deletion after use
  - Rate limiting (RATE_LIMITS.RESET_PASSWORD)
  - Error handling

**TanStack Migration Needed:**
- Create `apps/wodsmith-start/src/routes/_auth/reset-password.tsx`
- Implement token validation in route `validateSearch`
- Convert `resetPasswordAction` to `createServerFn`
- Implement rate limiting
- Handle missing token case (404)

**Dependencies:**
- KV store access
- Password hashing utility
- Reset token key generation (`getResetTokenKey`)

---

## Email Verification Routes

### Verify Email

| Route | Next.js Path | TanStack Path | Status | Components | Actions | Tests | Notes |
|-------|-------------|---------------|--------|------------|---------|-------|-------|
| Verify Email | `/verify-email?token=...` | N/A | ❌ Not Started | `verify-email.client.tsx`, `page.tsx`, `not-found.tsx` | `verifyEmailAction` | ❌ E2E, ❌ Integration, ❌ Unit | Validates token, verifies email |

**Next.js Implementation:**
- **Route**: `apps/wodsmith/src/app/(auth)/verify-email/`
- **Components**:
  - `page.tsx` - Server component wrapper (validates token exists)
  - `verify-email.client.tsx` - Client component
  - `not-found.tsx` - Custom 404 for missing token
- **Actions**:
  - `verify-email.action.ts` - `verifyEmailAction`
  - `resend-verification.action.ts` - `resendVerificationAction`
- **Features**:
  - Token validation from URL query param
  - Token lookup in KV store
  - Token expiration check
  - User lookup
  - Email verification status update (`emailVerified` timestamp)
  - Session update for all user sessions (`updateAllSessionsOfUser`)
  - Token deletion after use
  - 500ms delay to ensure session updates propagate
  - Rate limiting (RATE_LIMITS.EMAIL)
  - Resend verification email functionality

**TanStack Migration Needed:**
- Create `apps/wodsmith-start/src/routes/_auth/verify-email.tsx`
- Implement token validation in route
- Convert `verifyEmailAction` to `createServerFn`
- Convert `resendVerificationAction` to `createServerFn`
- Implement rate limiting
- Handle missing token case (404)

**Dependencies:**
- KV store access
- Session management (`updateAllSessionsOfUser`)
- Email service for resend functionality
- Verification token key generation (`getVerificationTokenKey`)

**Important Notes:**
- Current Next.js app auto-verifies email on signup, so this route may be legacy
- Passkey registration flow still uses email verification
- Consider if email verification is needed in TanStack migration

---

### Resend Verification

| Route | Next.js Path | TanStack Path | Status | Components | Actions | Tests | Notes |
|-------|-------------|---------------|--------|------------|---------|-------|-------|
| Resend Verification | (Action only, no dedicated route) | N/A | ❌ Not Started | N/A | `resendVerificationAction` | ❌ Integration | Generates new token, sends email |

**Next.js Implementation:**
- **Action File**: `apps/wodsmith/src/app/(auth)/resend-verification.action.ts`
- **Actions**:
  - `resendVerificationAction` - Sends new verification email
- **Features**:
  - Session-based (requires authenticated user)
  - Checks if email already verified
  - Generates new verification token
  - Stores token in KV with TTL
  - Sends verification email
  - Rate limiting (RATE_LIMITS.EMAIL)

**TanStack Migration Needed:**
- Create server function in relevant route or shared actions file
- Convert to `createServerFn`
- Implement session check
- Implement rate limiting

**Dependencies:**
- Session management
- KV store access
- Email service

---

## SSO Routes

### Google OAuth Callback

| Route | Next.js Path | TanStack Path | Status | Components | Actions | Tests | Notes |
|-------|-------------|---------------|--------|------------|---------|-------|-------|
| Google OAuth | `/sso/google` | N/A | ❌ Not Started | `route.ts` (redirect to Google) | N/A | ❌ E2E, ❌ Integration | Initiates OAuth flow |
| Google Callback | `/sso/google/callback` | N/A | ❌ Not Started | `google-callback.client.tsx`, `page.tsx` | `googleSSOCallbackAction` | ❌ E2E, ❌ Integration, ❌ Unit | Handles OAuth callback, creates/links account |

**Next.js Implementation:**
- **Route**: `apps/wodsmith/src/app/(auth)/sso/google/`
- **OAuth Initiation**:
  - `route.ts` - Generates OAuth URL with state and PKCE, redirects to Google
- **OAuth Callback**:
  - `callback/page.tsx` - Server component wrapper
  - `callback/google-callback.client.tsx` - Client component
  - `callback/google-callback.action.ts` - `googleSSOCallbackAction`
- **Features**:
  - OAuth state validation (CSRF protection)
  - PKCE code verifier validation
  - Authorization code exchange for tokens
  - ID token decoding (Arctic library)
  - User lookup by Google account ID
  - User lookup by email (account linking)
  - New user creation
  - Google account linking to existing user
  - Auto-verify email on Google SSO signup
  - Personal team creation for new users
  - Session creation
  - Cookie management (state, code verifier)
  - Rate limiting (RATE_LIMITS.GOOGLE_SSO_CALLBACK)
  - Disposable email checking

**TanStack Migration Needed:**
- Create `apps/wodsmith-start/src/routes/_auth/sso/google/index.tsx` (initiation)
- Create `apps/wodsmith-start/src/routes/_auth/sso/google/callback.tsx` (callback)
- Implement OAuth state and PKCE flow
- Convert `googleSSOCallbackAction` to `createServerFn`
- Implement cookie management
- Implement rate limiting
- Add flag check (`isGoogleSSOEnabled`)

**Dependencies:**
- Arctic OAuth library
- Google SSO client (`getGoogleSSOClient`)
- Cookie management
- KV or session storage for OAuth state
- Feature flag system

---

## Team Invite Routes

### Team Invite

| Route | Next.js Path | TanStack Path | Status | Components | Actions | Tests | Notes |
|-------|-------------|---------------|--------|------------|---------|-------|-------|
| Team Invite | `/team-invite?token=...` | N/A | ❌ Not Started | `team-invite.client.tsx`, `page.tsx`, `not-found.tsx` | `acceptTeamInviteAction` | ❌ E2E, ❌ Integration | Accepts team invitation |

**Next.js Implementation:**
- **Route**: `apps/wodsmith/src/app/(auth)/team-invite/`
- **Components**:
  - `page.tsx` - Server component wrapper (validates token exists)
  - `team-invite.client.tsx` - Client component
  - `not-found.tsx` - Custom 404 for missing token
- **Actions**:
  - `team-invite.action.ts` - `acceptTeamInviteAction`
- **Features**:
  - Token validation from URL query param
  - Session requirement (must be logged in)
  - Team invitation acceptance (`acceptTeamInvitation` server function)
  - PostHog analytics tracking (server-side)
  - Rate limiting (RATE_LIMITS.EMAIL)
  - Error handling

**TanStack Migration Needed:**
- Create `apps/wodsmith-start/src/routes/_auth/team-invite.tsx`
- Implement token validation in route
- Convert `acceptTeamInviteAction` to `createServerFn`
- Implement session check in `beforeLoad`
- Implement rate limiting
- Add PostHog analytics
- Handle missing token case (404)

**Dependencies:**
- Session management
- Team invitation service (`acceptTeamInvitation`)
- PostHog analytics

---

## Shared Components

### SSO Buttons

| Component | Next.js Path | TanStack Path | Status | Tests | Notes |
|-----------|-------------|---------------|--------|-------|-------|
| SSO Buttons | `(auth)/_components/sso-buttons.tsx` | N/A | ❌ Not Started | ❌ None | Used in sign-in and sign-up pages |

**Next.js Implementation:**
- **File**: `apps/wodsmith/src/app/(auth)/_components/sso-buttons.tsx`
- **Features**:
  - Client component
  - Google SSO button
  - Feature flag check (`isGoogleSSOEnabled` from config store)
  - PostHog analytics tracking
  - Loading skeleton while flag loads
  - Different text for sign-in vs sign-up

**TanStack Migration Needed:**
- Create equivalent component in TanStack Start
- Implement feature flag checking
- Add PostHog analytics
- Import and use in sign-in/sign-up routes

---

## Actions Summary

### Implemented Actions

| Action | File | Purpose | Status | Tests | Dependencies |
|--------|------|---------|--------|-------|--------------|
| `signInAction` | `sign-in.actions.ts` | Email/password authentication | ✅ Migrated as `signInServerFn` | ❌ Integration | User table, password verification, session creation, rate limiting |
| `signUpAction` | `sign-up.actions.ts` | Email/password registration | ✅ Migrated as `signUpServerFn` | ❌ Integration | User table, password hashing, team creation, session creation, rate limiting, captcha |
| `startPasskeyRegistrationAction` | `passkey-sign-up.actions.ts` | Start WebAuthn registration | ❌ Not Started | ❌ Integration | WebAuthn, user creation, team creation, KV cookies, captcha |
| `completePasskeyRegistrationAction` | `passkey-sign-up.actions.ts` | Complete WebAuthn registration | ❌ Not Started | ❌ Integration | WebAuthn verification, email verification, session creation |
| `forgotPasswordAction` | `forgot-password.action.ts` | Request password reset | ❌ Not Started | ❌ Integration | KV store, email service, rate limiting, captcha |
| `resetPasswordAction` | `reset-password.action.ts` | Reset password with token | ❌ Not Started | ❌ Integration | KV store, password hashing, rate limiting |
| `verifyEmailAction` | `verify-email.action.ts` | Verify email address | ❌ Not Started | ❌ Integration | KV store, session updates, rate limiting |
| `resendVerificationAction` | `resend-verification.action.ts` | Resend verification email | ❌ Not Started | ❌ Integration | KV store, email service, session check, rate limiting |
| `googleSSOCallbackAction` | `google-callback.action.ts` | Handle Google OAuth callback | ❌ Not Started | ❌ Integration | Arctic OAuth, Google SSO client, user/team creation, session creation, rate limiting |
| `acceptTeamInviteAction` | `team-invite.action.ts` | Accept team invitation | ❌ Not Started | ❌ Integration | Session check, team invitation service, PostHog, rate limiting |

---

## Migration Dependencies

### Core Dependencies

| Dependency | Usage | Migration Status | Notes |
|------------|-------|------------------|-------|
| ZSA (`createServerAction`) | Server actions in Next.js | 🔄 Replace with `createServerFn` | TanStack Start uses `createServerFn` instead |
| Rate Limiting (`withRateLimit`) | All actions | ❌ Not Implemented | Need to implement rate limiting for TanStack Start |
| Session Management | Auth flows | 🔄 Partial | `createAndStoreSession` migrated, need `getSessionFromCookie` |
| KV Store (Cloudflare) | Token storage | ❌ Not Implemented | Needed for reset/verification tokens, OAuth state |
| Email Service (Resend) | Verification, password reset | ❌ Not Implemented | Need email templates and sending |
| PostHog Analytics | Tracking | ❌ Not Implemented | Need client and server-side tracking |
| Turnstile Captcha | Bot protection | ❌ Not Implemented | Sign-up and forgot-password flows |
| Feature Flags | SSO, Turnstile | ❌ Not Implemented | Need flag system for TanStack Start |

### Utilities

| Utility | File | Purpose | Migration Status |
|---------|------|---------|------------------|
| `hashPassword` | `utils/password-hasher.ts` | Password hashing | ✅ Used in TanStack |
| `verifyPassword` | `utils/password-hasher.ts` | Password verification | ✅ Used in TanStack |
| `canSignUp` | `utils/auth.ts` | Disposable email check | ❌ Not used in TanStack yet |
| `createAndStoreSession` | `utils/auth.ts` | Session creation | ✅ Used in TanStack |
| `getSessionFromCookie` | `utils/auth.ts` | Session retrieval | ❌ Not implemented for TanStack |
| `updateAllSessionsOfUser` | `utils/kv-session.ts` | Batch session update | ❌ Not implemented |
| `getVerificationTokenKey` | `utils/auth-utils.ts` | KV key generation | ❌ Not implemented |
| `getResetTokenKey` | `utils/auth-utils.ts` | KV key generation | ❌ Not implemented |
| `sendVerificationEmail` | `utils/email.ts` | Email sending | ❌ Not implemented |
| `sendPasswordResetEmail` | `utils/email.ts` | Email sending | ❌ Not implemented |
| `getIP` | `utils/get-IP.ts` | IP address retrieval | ❌ Not used in TanStack yet |
| `validateTurnstileToken` | `utils/validate-captcha.ts` | Captcha validation | ❌ Not implemented |
| `getGoogleSSOClient` | `lib/sso/google-sso.ts` | Google OAuth client | ❌ Not implemented |
| `generatePasskeyRegistrationOptions` | `utils/webauthn.ts` | WebAuthn setup | ❌ Not implemented |
| `verifyPasskeyRegistration` | `utils/webauthn.ts` | WebAuthn verification | ❌ Not implemented |
| `createPersonalTeamForUser` | `server/user.ts` | Team creation | 🔄 Inlined in TanStack |
| `processApprovedInvitationsForEmail` | `server/team-members.ts` | Invitation processing | ❌ Not implemented |
| `acceptTeamInvitation` | `server/team-members.ts` | Team invite acceptance | ❌ Not implemented |

---

## Migration Priorities

### P0 - Core Auth (Blocking)
1. ✅ Sign In (email/password) - **DONE**
2. ✅ Sign Up (email/password) - **DONE**
3. ❌ Session management (`getSessionFromCookie` for TanStack)
4. ❌ Rate limiting implementation

### P1 - Password Management
1. ❌ Forgot Password route and action
2. ❌ Reset Password route and action
3. ❌ KV store integration for tokens
4. ❌ Email service integration

### P2 - Enhanced Security
1. ❌ Google SSO (initiation + callback)
2. ❌ Turnstile captcha integration
3. ❌ Feature flag system
4. ❌ PostHog analytics

### P3 - Advanced Features
1. ❌ Email verification flow
2. ❌ Passkey registration (WebAuthn)
3. ❌ Team invite acceptance
4. ❌ SSO buttons component

---

## Technical Notes

### ZSA to TanStack Start Conversion Pattern

**Next.js (ZSA):**
```typescript
export const myAction = createServerAction()
  .input(mySchema)
  .handler(async ({ input }) => {
    return withRateLimit(async () => {
      // ... logic
      throw new ZSAError("NOT_AUTHORIZED", "Error message")
    }, RATE_LIMITS.MY_ACTION)
  })
```

**TanStack Start:**
```typescript
export const myServerFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => mySchema.parse(data))
  .handler(async ({data}) => {
    // TODO: Add rate limiting
    // ... logic
    throw new Error("Error message")
  })
```

### Key Differences
- ZSA uses `createServerAction()`, TanStack uses `createServerFn({method: 'POST'})`
- ZSA has `input()`, TanStack has `inputValidator()` (with custom Zod parser)
- ZSA passes `{ input }`, TanStack passes `{ data }`
- ZSA uses `ZSAError`, TanStack uses plain `Error`
- TanStack needs manual rate limiting implementation

### Session Management Differences
- Next.js: `getSessionFromCookie()` works out of the box
- TanStack: Needs custom implementation for session retrieval
- TanStack: Session checks typically happen in route `beforeLoad` hook

### Cookie Management
- Next.js: `cookies()` from `next/headers`
- TanStack: Need equivalent cookie handling (investigate TanStack Start's cookie API)

### Feature Flags
- Next.js: Uses custom flag system with `isGoogleSSOEnabled()`, `isTurnstileEnabled()`
- TanStack: Needs equivalent flag system implementation

---

## Questions for Architecture Decision

1. **Email Verification**: Current Next.js app auto-verifies email on signup. Do we want to keep this pattern or implement full email verification in TanStack Start?

2. **Rate Limiting**: How should rate limiting be implemented in TanStack Start? Custom middleware? Edge function?

3. **KV Store Access**: What's the best way to access Cloudflare KV in TanStack Start server functions?

4. **Session Management**: Should we create a TanStack-specific session utility, or adapt existing Next.js utilities?

5. **Error Handling**: Should we create a TanStack-compatible error wrapper similar to ZSAError for consistent error responses?

6. **Passkey Priority**: Passkey authentication is complex (WebAuthn). Should this be migrated early or can it wait until P3?

7. **Team Creation**: TanStack Start inlines personal team creation. Should we extract this to a shared utility for consistency?

---

## Next Steps

1. **Implement session management** - Create `getSessionFromCookie` equivalent for TanStack Start
2. **Add rate limiting** - Implement rate limiting wrapper for TanStack server functions
3. **KV store integration** - Set up Cloudflare KV access pattern for TanStack Start
4. **Migrate password management** - Forgot password and reset password routes
5. **Email service integration** - Set up Resend for verification and password reset emails
6. **Feature flags** - Implement flag system for SSO and captcha toggles
7. **Google SSO** - Migrate OAuth flow and callback handling
8. **Analytics** - Integrate PostHog for both client and server-side tracking
9. **Captcha** - Integrate Turnstile for bot protection
10. **Email verification** - Decide on strategy and implement if needed
11. **Passkeys** - Migrate WebAuthn registration and authentication
12. **Team invites** - Migrate team invitation acceptance flow

---

## Audit History

### 2025-12-24 - Test Coverage Audit (AuthDocWorker)
**Added:**
- ✅ New "Step 0: Test Requirements" section with Testing Trophy strategy
- ✅ "Tests" column added to all route tables (8 routes)
- ✅ "Tests" column added to Actions Summary table (10 actions)
- ✅ Documented existing E2E tests in `e2e/auth.spec.ts` (8 tests)
- ✅ Documented missing integration tests for all 10 auth actions
- ✅ Documented missing unit tests for auth utilities

**Test Coverage Findings:**
- **E2E**: 8 tests exist covering sign-in flows (P0 adequate)
- **Integration**: 0 tests for auth actions (CRITICAL GAP)
- **Unit**: 0 tests for auth utilities (password hashing, token generation)

**Recommendations:**
1. Create integration tests for `signInAction` and `signUpAction` before proceeding with P1 routes
2. Add E2E test for sign-up flow
3. Create unit tests for `hashPassword`, `verifyPassword`, `canSignUp`

### 2025-12-23 - Documentation Audit (CalmStorm)
**Verified:**
- ✅ All 8 Next.js routes documented (sign-in, sign-up, forgot-password, reset-password, verify-email, google-oauth, google-callback, team-invite)
- ✅ All 10 Next.js actions cataloged
- ✅ TanStack routes match documented status (2 migrated: sign-in, sign-up)
- ✅ Migration status accuracy verified against actual codebase

**Corrections Made:**
1. **Route count**: Updated from 7 to 8 routes (Google OAuth initiation and callback are separate routes)
2. **Sign-up disposable email checking**: Corrected - `canSignUp` IS implemented in TanStack (line 51 of sign-up.tsx), marked as ✅ migrated

**Remaining Discrepancy:**
- Summary shows "25% complete" (2/8 routes), updated from previous "29%" (which was based on 2/7 routes)

---

**Last Updated:** 2025-12-24  
**Document Version:** 1.2 (Test Coverage Added)
