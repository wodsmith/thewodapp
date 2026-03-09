# Session Context

## User Prompts

### Prompt 1

Check if this issue is valid — if so, understand the root cause and fix it. At apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx, line 1130:

<comment>Audit-log penalty preview uses `isLowerBetter(scheme)` without considering cap status, so capped `time-with-cap` entries can show the wrong Addition/Deduction direction.</comment>

<file context>
@@ -1007,6 +948,360 @@ function VerificationControls({
+                            <p clas...

### Prompt 2

commit and push

