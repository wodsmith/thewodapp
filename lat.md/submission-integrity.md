---
lat:
  require-code-mention: true
---
# Submission Integrity

Online athlete submissions persist evidence, scores, and rounds together; replacements require fresh review, and reviewer actions stay in the score's division.

[[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#submitVideoFn]] completes score, round, and tiebreak validation before mutation, then updates video, score, and rounds in one transaction. Replacing a video resets its current review fields and the shared score's verification and penalty fields while retaining historical verification logs. A partner video-only replacement preserves score values and rounds while reopening shared-score review, except that an invalid score remains excluded until a valid replacement score arrives. Other video slots and divisions remain untouched. The dedicated benchmark transaction and best-score retention rules are unchanged.

[[apps/wodsmith-start/src/server-fns/submission-verification-fns.ts#verifySubmissionScoreFn]] resolves the video's registration from the selected score's user and scaling level. Null scaling levels explicitly match null registration divisions. Verify, adjust, and invalidate share this registration scope.

The real MySQL tests at [[apps/wodsmith-start/test/integration/submission-integrity.test.ts]] use InnoDB, production column types, and the score/video/round unique constraints in a disposable database. Other required fields are nullable to keep unrelated seed data out of the fixture. They run in the database integration CI job; normal unit tests require no MySQL. The shared integration runner requires explicit local fixture configuration and never reads application database credentials.

## Invalid input preserves persisted state

Invalid scores, round values, and tiebreaks are rejected before any persisted evidence, score, round, or review state changes.

## Failed round replacement rolls back

A real MySQL trigger rejects new rounds after existing rounds are deleted; the transaction must restore the previous video, score, rounds, and review fields and allow a later successful retry.

## Replacement requires review

Replacing verified, adjusted, or invalid athlete evidence clears current verification and penalty fields, returns the video to pending review, and preserves historical verification logs.

## Partner evidence resets shared review

A partner video-only replacement clears the shared score's review metadata without changing its value or rounds, another video slot, another division, or past review logs.

## Invalid score stays excluded without a replacement score

A partner video-only replacement leaves a zeroed invalid score and its review metadata untouched so it stays excluded from public ranking. A later valid score payload reopens score review without deleting audit history.

## Review stays in the score division

Verify, adjust, and invalidate update only videos belonging to the score's division, including the null division, when the same athlete also owns a registration in another division.
