# Game Day announcement push

Organizer announcements can notify signed-in registered athletes who opt into iOS alerts. Delivery uses recorded broadcast recipients and never treats installation or spectator following as permission to send.

## Recipient access

Both WODsmith and Crew snapshot device deliveries in the announcement transaction, after their existing audience filters and recipient deduplication. The WODsmith worker delivers the shared outbox.

A job must still match its device owner, subscription, valid session, sent broadcast recipient row, and active registration in a published competition before sending. Public audiences do not include arbitrary app installations. Invite-only recipients lack a user binding.

The push contains only a generic alert and competition/announcement identifiers. Tapping retrieves the competition through the existing authenticated API and selects the exact permitted announcement. No private announcement title or body is placed in the Apple payload or trusted from a notification.

## Device ownership

The bearer-only device API derives ownership from the session. Tokens are unique within each APNs environment. A new account uses a new subscription identifier; delayed deletes must match the original user, session, and subscription.

Native registration, token changes, and cleanup are serialized. The app stores a pending subscription in a separate Keychain item before uploading so a lost response remains revocable. Offline sign-out clears sign-in and retains only the pending cleanup credential; reopening retries cleanup before registration.

Devices expire after seven days without renewal or at session expiry, whichever is earlier. Every delivery revalidates session revocation. Disabled system permission removes the device subscription when the app next observes it. Apple may still present an already accepted generic alert around sign-out; opening it always checks the current account.

## Delivery semantics

The transactional outbox decouples email from push. A one-minute scheduled dispatcher enqueues due identifiers; an atomic two-minute database lease prevents concurrent queue retries from sending the same job.

Successful APNs acceptance marks the job sent. Transient failures use bounded exponential backoff, at most ten provider attempts within 24 hours. Invalid tokens are removed only if their registration has not been refreshed since Apple's invalidation timestamp. The consumer acknowledges handled jobs; the outbox recovers lost queue sends and crashed workers.

Missing credentials and signing failures keep jobs pending without consuming the provider retry budget. The 24-hour expiry still bounds recovery when configuration remains unavailable.

Stable APNs request and collapse identifiers reduce duplicate presentation. Exactly-once visible delivery cannot be guaranteed if APNs accepts a request and its response or the following database write is lost. APNs expiration is zero to avoid retaining undelivered alerts after sign-out. Provider JWTs are reused within the isolate for 50 minutes.

An unreachable device can miss an accepted alert because Apple does not store it for later delivery. The announcement remains available in the authenticated app. The worker rechecks job expiry with its final lease check before contacting Apple.

Expired device bindings are deleted during dispatch. Delivery records are deleted 30 days after their one-day expiry. Neither device tokens nor session credentials enter organizer reads or delivery logs.

## Rollout

Push is disabled by default. Apply `0010_gameday_push.sql` through the normal PlanetScale schema process before enabling `GAMEDAY_PUSH_ENABLED`. Configure APNs credentials and the WODsmith queue consumer/one-minute cron in the same environment.

Required secrets are `APNS_KEY_ID`, `APNS_TEAM_ID`, and `APNS_PRIVATE_KEY` (Apple P-256 token-signing key). WODsmith sends for topic `com.wodsmith.gameday`. Crew only writes the shared outbox and must not be enabled before WODsmith delivery is configured against that database. Never enable the same production token/key combination against a development database.

Deployment workflows pass the push flag and credentials only to the production stage. Both Alchemy configurations independently disable push outside production, and the dispatcher cron uses one shared schedule constant. Local tests use isolated mocks.

The native target adds the Push Notifications entitlement, with sandbox in Debug and production in Release. Signing profiles must contain the matching entitlement. The inspected Apple identifier has push disabled, and the attempted signed archive fails because the existing profile lacks Push Notifications and `aps-environment`. The follow-up source version is 1.2 build 6; version 1.1 build 5 remains untouched in App Store Connect.

All physical-device Debug builds and Release archives from this source require the new signing capability; the backend runtime flag does not remove that requirement. Simulator builds remain available while Apple configuration is pending.

Production deployment requires the separately requested authorization. Do not submit the follow-up iOS version until the backend, signing capability, Apple privacy Device ID disclosure, and a controlled real APNs send are verified. Simulator-injected notifications verify presentation and tapping only; they do not prove APNs delivery.

## Tests

Backend tests exercise SQL authorization predicates and the delivery state machine with a MySQL proxy, plus the APNs wire contract. Native tests use the real API client with a controlled URL protocol to suspend and fail device requests.

### Device API boundary

Reject anonymous requests and client-supplied ownership, bind devices to the validated bearer session, and scope delayed cleanup to its original subscription.

### Recorded audience outbox

Verify the outbox snapshots only recorded recipients with unexpired devices using the supplied database transaction. Existing audience expansion tests continue to cover division, volunteer, invitation, and question filtering.

### Delivery authorization and duplicates

Require an acquired lease, current device owner, live session, recorded recipient, and active competition registration. Missing or revoked access skips delivery, and an unclaimed duplicate never calls Apple.

### Provider recovery

Retry transient failures and remove invalid tokens with a timestamp guard so a newer registration cannot be deleted by an old provider response.

### APNs wire contract

Verify generic payload content, correct topic and environment, stable collapse/request identifiers, response classification, and an independently verified ES256 provider signature.

### Native registration ordering

Suspend a registration request during sign-out and verify cleanup follows it. A successfully committed old registration cannot survive completion of online sign-out.

### Offline revocation recovery

Retain a failed offline deregistration across manager recreation, then retry it without restoring sign-in. Account switches delete the old binding before registering the new owner, and late token callbacks cannot reverse denied permission.

### Native announcement routing

Retain valid announcement identifiers through cold launch and session expiry. Explicit sign-out clears the destination. Reject malformed identifiers and open the exact announcement only through the current authenticated account.

### Queue dispatch isolation

Push messages use an explicit kind discriminator. Email messages retain their original path, while an unpersisted push consumer failure requests queue redelivery.

### Configuration recovery budget

Missing APNs credentials and signing failures must not increment provider attempts. Jobs remain pending for recovery within their original expiry.

### Independent home refresh

Suspended push cleanup must not delay competition home requests or refresh completion.

Home refresh marks its loading state before asynchronous work, while push synchronization proceeds independently. Announcement loads ignore stale account and cancelled request results.
