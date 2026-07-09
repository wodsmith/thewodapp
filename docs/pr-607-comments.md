# PR 607 Comments

Pulled comments for [[codex] Add Excel support for Crew imports](https://github.com/wodsmith/thewodapp/pull/607) on 2026-07-08T05:04:18.556Z.

- Repository: `wodsmith/thewodapp`
- Branch: `crew-import-excel`
- PR: #607
- Top-level comments: 1
- Review submissions: 4
- Inline review comments: 20

> Note: `gh` and the GitHub connector both had expired auth tokens, so these were fetched through GitHub's public REST API. Public REST does not include review-thread resolution state.

## Top-Level Conversation Comments

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-06-27T22:48:22Z · <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_st...</summary>

- Author: coderabbitai[bot]
- Created: 2026-06-27T22:48:22Z, updated 2026-07-07T22:49:55Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#issuecomment-4822597008

<!-- This is an auto-generated comment: summarize by coderabbit.ai -->
<!-- review_stack_entry_start -->

[![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/wodsmith/thewodapp/pull/607?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)

<!-- review_stack_entry_end -->
<!-- walkthrough_start -->

## Walkthrough
This PR adds Excel upload support to crew imports, routes raw file bytes through preview and upload flows, and expands volunteer imports to map, create, and apply question data. It also updates the crew import docs and repository instruction docs.

### Changes

**Crew import parsing and upload flow**

|Layer / File(s)|Summary|
|---|---|
|**Shared parsing core** <br> `apps/crew/package.json`, `apps/crew/src/lib/crew/imports/tabular.ts`, `apps/crew/src/lib/crew/imports/csv.ts`, `apps/crew/src/lib/crew/imports/xlsx.ts`, `apps/crew/src/lib/crew/imports/file.ts`, `apps/crew/src/lib/crew/imports/types.ts`, `apps/crew/src/lib/crew/imports/preview.test.ts`, `apps/crew/src/lib/crew/imports/mapping-memory.test.ts`|Adds shared tabular parsing, Excel workbook parsing, file-type dispatch, parser version updates, and coverage for CSV/Excel preview behavior.|
|**Preview record and raw-byte flow** <br> `apps/crew/src/lib/crew/imports/preview.ts`, `apps/crew/src/server/crew-imports.server.ts`, `apps/crew/src/routes/api/crew/import.ts`|Preview creation now accepts raw uploaded bytes and passes file objects through to the shared parser.|
|**Heats and import tabs UI** <br> `apps/crew/src/components/crew/crew-import-tabs.tsx`, `apps/crew/src/routes/events/$eventId/heats.tsx`|The upload UIs switch to CSV-or-Excel wording, shared accept lists, and file parsing via the new parser entry point.|
|**Volunteer import flow UI** <br> `apps/crew/src/components/crew/volunteer-import-flow.tsx`|Volunteer upload, mapping, and preview UI now handles CSV-or-Excel files, built-in suggestions, question planning, and updated validation text.|

**Volunteer import mapping and apply flow**

|Layer / File(s)|Summary|
|---|---|
|**Question mapping contracts** <br> `apps/crew/src/lib/crew/imports/question-mapping.ts`, `apps/crew/src/lib/crew/imports/question-mapping.test.ts`, `apps/crew/src/lib/crew/imports/column-mapping.ts`, `apps/crew/src/lib/crew/imports/normalize-volunteer-row.ts`, `apps/crew/src/lib/crew/imports/types.ts`|Defines question-mapping keys, resolved question columns, preview planning shapes, and expanded volunteer row fields.|
|**Built-in preset selection** <br> `apps/crew/src/lib/crew/imports/builtin-presets.ts`, `apps/crew/src/lib/crew/imports/builtin-presets.test.ts`, `apps/crew/src/lib/crew/imports/mapping-memory.ts`, `apps/crew/src/lib/crew/imports/mapping-memory.test.ts`, `apps/crew/src/server/crew-imports.server.ts`, `apps/crew/src/server-fns/crew-import-fns.ts`, `lat.md/crew.md`|Adds built-in mapping presets and returns built-in suggestions alongside saved mapping suggestions.|
|**Volunteer question resolution** <br> `apps/crew/src/lib/crew/imports/apply.ts`, `apps/crew/src/lib/crew/imports/apply.test.ts`, `apps/crew/src/lib/crew/imports/preview.ts`, `apps/crew/src/lib/crew/imports/preview.test.ts`, `apps/crew/src/server/crew-imports.server.ts`|Resolves volunteer question columns, plans question creation, extracts answers, and carries that data through preview and apply logic.|
|**Volunteer apply and UI** <br> `apps/crew/src/server/crew-imports.server.ts`, `apps/crew/src/server-fns/crew-import-fns.ts`, `apps/crew/src/components/crew/volunteer-import-flow.tsx`|Loads volunteer questions for import, creates missing questions, upserts answers, and surfaces the question plan in the UI.|

**Process and documentation updates**

|Layer / File(s)|Summary|
|---|---|
|**Instruction docs** <br> `AGENTS.md`, `CLAUDE.md`|Adds GitNexus guidance blocks and command/resource references to the project instruction documents.|
|**Crew import docs** <br> `lat.md/crew.md`|Updates crew import documentation for CSV-or-Excel uploads, raw-byte parsing, volunteer question metadata, and built-in presets.|

**Estimated code review effort:** 5 (Critical) | ~120 minutes

**Possibly related PRs**
- [wodsmith/thewodapp#312](https://github.com/wodsmith/thewodapp/pull/312): Shares the volunteer import question and answer data path that this PR now wires into preview and apply.
- [wodsmith/thewodapp#530](https://github.com/wodsmith/thewodapp/pull/530): Extends the same crew import preview pipeline and column-mapping flow that this PR broadens to Excel and question planning.
- [wodsmith/thewodapp#531](https://github.com/wodsmith/thewodapp/pull/531): Touches the same import apply backend that this PR extends for volunteer question creation and answer writes.

**Suggested reviewers:** `theianjones`

**Poem**
> A rabbit hopped by with a CSV grin,
> Then found Excel sheets and leapt right in.  
> 🐇📄✨  
> Questions to ask, and answers to grow,  
> Through tabs and bytes, the imports flow.

<!-- walkthrough_end -->
<!-- pre_merge_checks_walkthrough_start -->

<details>
<summary>🚥 Pre-merge checks | ✅ 5</summary>

<details>
<summary>✅ Passed checks (5 passed)</summary>

|         Check name         | Status   | Explanation                                                                                                |
| :------------------------: | :------- | :--------------------------------------------------------------------------------------------------------- |
|     Docstring Coverage     | ✅ Passed | No functions found in the changed files to evaluate docstring coverage. Skipping docstring coverage check. |
|     Linked Issues check    | ✅ Passed | Check skipped because no linked issues were found for this pull request.                                   |
| Out of Scope Changes check | ✅ Passed | Check skipped because no linked issues were found for this pull request.                                   |
|      Description Check     | ✅ Passed | Check skipped - CodeRabbit’s high-level summary is enabled.                                                |
|         Title check        | ✅ Passed | The title clearly summarizes the primary change: adding Excel support for Crew imports.                    |

</details>

</details>

<!-- pre_merge_checks_walkthrough_end -->
<!-- finishing_touch_checkbox_start -->

<details>
<summary>✨ Finishing Touches</summary>

<details>
<summary>📝 Generate docstrings</summary>

- [ ] <!-- {"checkboxId": "7962f53c-55bc-4827-bfbf-6a18da830691"} --> Create stacked PR
- [ ] <!-- {"checkboxId": "3e1879ae-f29b-4d0d-8e06-d12b7ba33d98"} --> Commit on current branch

</details>
<details>
<summary>🧪 Generate unit tests (beta)</summary>

- [ ] <!-- {"checkboxId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "radioGroupId": "utg-output-choice-group-unknown_comment_id"} -->   Create PR with unit tests
- [ ] <!-- {"checkboxId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "radioGroupId": "utg-output-choice-group-unknown_comment_id"} -->   Commit unit tests in branch `crew-import-excel`

</details>

</details>

<!-- finishing_touch_checkbox_end -->
<!-- tips_start -->

---

Thanks for using [CodeRabbit](https://coderabbit.ai?utm_source=oss&utm_medium=github&utm_campaign=wodsmith/thewodapp&utm_content=607)! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.

<details>
<summary>❤️ Share</summary>

- [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20the%20proprietary%20code.%20Check%20it%20out%3A&url=https%3A//coderabbit.ai)
- [Mastodon](https://mastodon.social/share?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20the%20proprietary%20code.%20Check%20it%20out%3A%20https%3A%2F%2Fcoderabbit.ai)
- [Reddit](https://www.reddit.com/submit?title=Great%20tool%20for%20code%20review%20-%20CodeRabbit&text=I%20just%20used%20CodeRabbit%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20proprietary%20code.%20Check%20it%20out%3A%20https%3A//coderabbit.ai)
- [LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcoderabbit.ai&mini=true&title=Great%20tool%20for%20code%20review%20-%20CodeRabbit&summary=I%20just%20used%20CodeRabbit%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20proprietary%20code)

</details>


<sub>Comment `@coderabbitai help` to get the list of available commands.</sub>

<!-- tips_end -->

</details>

## Review Submissions

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-07-03T22:26:50Z · **Actionable comments posted: 2** <details> <summary>🧹 Nitpick comments (1)</summary><blockquote...</summary>

- Author: coderabbitai[bot]
- Created: 2026-07-03T22:26:50Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#pullrequestreview-4628267412

- State: COMMENTED

**Actionable comments posted: 2**

<details>
<summary>🧹 Nitpick comments (1)</summary><blockquote>

<details>
<summary>apps/crew/src/lib/crew/imports/preview.ts (1)</summary><blockquote>

`37-54`: _🎯 Functional Correctness_ | _🔵 Trivial_ | _⚡ Quick win_

**Consider guarding against neither `file` nor `csvText` being supplied.**

`file` and `csvText` are both optional with no runtime check that exactly one is provided. If both are omitted, `parseCsv(csvText ?? "", ...)` silently parses an empty string rather than surfacing a clear "no input provided" error. Current call sites (server route always passes `file`; tests always pass one or the other) avoid this today, but the contract is easy to violate silently in future refactors.
<details>
<summary>♻️ Suggested guard</summary>

```diff
   const parsed = file
     ? parseCrewImportFile(file, { maxRows: MAX_PREVIEW_ROWS })
-    : parseCsv(csvText ?? "", { maxRows: MAX_PREVIEW_ROWS })
+    : csvText !== undefined
+      ? parseCsv(csvText, { maxRows: MAX_PREVIEW_ROWS })
+      : (() => {
+          throw new Error("buildCrewImportPreview requires either `file` or `csvText`")
+        })()
```
</details>

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/lib/crew/imports/preview.ts` around lines 37 - 54, Add a
runtime guard in CrewImportPreview construction to require exactly one input
source before calling parseCrewImportFile or parseCsv. The current preview path
silently falls back to parseCsv(csvText ?? "") when both file and csvText are
missing, so update the logic around the parsed assignment to throw or return a
clear error when neither input is provided, and ensure the check is enforced in
the preview entrypoint rather than relying on call sites.
```

</details>

<!-- cr-comment:v1:d494ac9846183624e35e712c -->

</blockquote></details>

</blockquote></details>

<details>
<summary>🤖 Prompt for all review comments with AI agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

Inline comments:
In `@apps/crew/src/lib/crew/imports/tabular.ts`:
- Around line 91-97: The preview-limit warning in tabular import has a
singular/plural grammar mismatch in the message built in the skippedRowCount
block. Update the message logic in the code that pushes the preview_row_limit
issue so the singular case uses the correct verb form for 1 row, while keeping
the plural form for skippedRowCount > 1.

In `@apps/crew/src/lib/crew/imports/xlsx.ts`:
- Around line 24-30: The workbook import path in xlsx.ts unzips user-supplied
bytes without limiting the inflated size, so a compressed upload can expand past
MAX_CREW_IMPORT_BYTES. Update the import flow around unzipSync to enforce a
decompressed-byte cap before or during extraction, preferably by switching to a
streaming unzip approach with an aborting byte counter. Keep the change
localized to the workbook parsing logic that returns emptyWorkbookError on
failure.

---

Nitpick comments:
In `@apps/crew/src/lib/crew/imports/preview.ts`:
- Around line 37-54: Add a runtime guard in CrewImportPreview construction to
require exactly one input source before calling parseCrewImportFile or parseCsv.
The current preview path silently falls back to parseCsv(csvText ?? "") when
both file and csvText are missing, so update the logic around the parsed
assignment to throw or return a clear error when neither input is provided, and
ensure the check is enforced in the preview entrypoint rather than relying on
call sites.
```

</details>

<details>
<summary>🪄 Autofix (Beta)</summary>

Fix all unresolved CodeRabbit comments on this PR:

- [ ] <!-- {"checkboxId": "4b0d0e0a-96d7-4f10-b296-3a18ea78f0b9"} --> Push a commit to this branch (recommended)
- [ ] <!-- {"checkboxId": "ff5b1114-7d8c-49e6-8ac1-43f82af23a33"} --> Create a new PR with the fixes

</details>

---

<details>
<summary>ℹ️ Review info</summary>

<details>
<summary>⚙️ Run configuration</summary>

**Configuration used**: Path: .coderabbit.yaml

**Review profile**: CHILL

**Plan**: Pro

**Run ID**: `57337f9f-256c-4559-b9b2-d3812be6669e`

</details>

<details>
<summary>📥 Commits</summary>

Reviewing files that changed from the base of the PR and between 91e96aecbcccedaa8f89012fa02d594181c15474 and 53020952bba53fc0bd0fd3f0c8181ff644a2441e.

</details>

<details>
<summary>⛔ Files ignored due to path filters (1)</summary>

* `pnpm-lock.yaml` is excluded by `!**/pnpm-lock.yaml`

</details>

<details>
<summary>📒 Files selected for processing (15)</summary>

* `apps/crew/package.json`
* `apps/crew/src/components/crew/crew-import-tabs.tsx`
* `apps/crew/src/components/crew/volunteer-import-flow.tsx`
* `apps/crew/src/lib/crew/imports/csv.ts`
* `apps/crew/src/lib/crew/imports/file.ts`
* `apps/crew/src/lib/crew/imports/mapping-memory.test.ts`
* `apps/crew/src/lib/crew/imports/preview.test.ts`
* `apps/crew/src/lib/crew/imports/preview.ts`
* `apps/crew/src/lib/crew/imports/tabular.ts`
* `apps/crew/src/lib/crew/imports/types.ts`
* `apps/crew/src/lib/crew/imports/xlsx.ts`
* `apps/crew/src/routes/api/crew/import.ts`
* `apps/crew/src/routes/events/$eventId/heats.tsx`
* `apps/crew/src/server/crew-imports.server.ts`
* `lat.md/crew.md`

</details>

</details>

<!-- This is an auto-generated comment by CodeRabbit for review status -->

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · **11 issues found** across 18 files <details> <summary>Prompt for AI agents (unresolved issues)</...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#pullrequestreview-4628307158

- State: COMMENTED

**11 issues found** across 18 files

<details>
<summary>Prompt for AI agents (unresolved issues)</summary>

```text

Check if these issues are valid — if so, understand the root cause of each and fix them. If appropriate, use sub-agents to investigate and fix each issue separately.


<file name="apps/crew/src/lib/crew/imports/xlsx.ts">

<violation number="1" location="apps/crew/src/lib/crew/imports/xlsx.ts:30">
P2: The decompression size cap relies on `file.originalSize` from the ZIP entry header, which is metadata declared by the file producer — it is not guaranteed to match the actual decompressed output. A crafted `.xlsx` could declare small entry sizes in its headers while compressing to much larger content, bypassing the `MAX_ENTRY_BYTES` / `MAX_TOTAL_BYTES` checks in the filter. Consider additionally checking the byte length of each decompressed entry after `unzipSync` returns (or switching to streaming decompression with an aborting counter) to defend against spoofed headers.</violation>

<violation number="2" location="apps/crew/src/lib/crew/imports/xlsx.ts:136">
P2: Imports can come back empty when the first workbook sheet is not a worksheet. The resolver currently follows the first `<sheet>` relationship blindly; selecting the first relationship with worksheet type would avoid skipping valid data tabs.</violation>

<violation number="3" location="apps/crew/src/lib/crew/imports/xlsx.ts:344">
P2: Time and dateTime formatting discards the seconds component of serial date/time values, causing data loss for cells with second-level precision (e.g., 14:30:45 becomes "2:30 PM"). The `secondsIntoDay` variable is computed on line 339 but neither `formatClockTime` nor the dateTime format string include seconds. For heat schedule imports where organizers may provide exact start times, this silently drops precision. Consider adding seconds to the output, at least for the dateTime format where the label suggests full precision.</violation>

<violation number="4" location="apps/crew/src/lib/crew/imports/xlsx.ts:417">
P2: A malformed numeric XML entity can throw during decode and fail the whole preview path. Guarding code points before `fromCodePoint` keeps parser behavior in the expected invalid-workbook error flow.</violation>
</file>

<file name="AGENTS.md">

<violation number="1" location="AGENTS.md:153">
P2: The 43-line GitNexus configuration block is duplicated verbatim across `AGENTS.md` and `CLAUDE.md`. These files serve different AI tool audiences, but the GitNexus content is identical. If tool commands, parameters, or workflow steps need updating in the future (e.g., a new parameter for `gitnexus_impact` or an additional pre-commit check), both files must be kept in sync. Consider extracting the shared GitNexus content into a single source and referencing it from each file, or adding a maintenance note in one of the files to remind contributors to update both when this section changes.</violation>
</file>

<file name="apps/crew/src/lib/crew/imports/preview.test.ts">

<violation number="1" location="apps/crew/src/lib/crew/imports/preview.test.ts:225">
P2: The test uses `numFmtId="20"` but expects 12-hour AM/PM output. Per the OOXML spec, numFmtId 20 is `h:mm` (24-hour, no AM/PM), and numFmtId 18 is `h:mm AM/PM` (12-hour). Use `numFmtId="18"` here so the format ID correctly corresponds to the expected "9:00 AM" output. This prevents a latent correctness issue from turning into a test failure if the parser later distinguishes 24-hour vs 12-hour time formats.</violation>
</file>
```

</details>

<sub>Reply with feedback, questions, or to request a fix.<br /><br />[Re-trigger cubic](https://www.cubic.dev/action/re-review/pr/wodsmith/thewodapp/607/ai_pr_review_1783117622083_aee75158-59a0-47fb-992b-2cc293ba1ba0?returnTo=https%3A%2F%2Fgithub.com%2Fwodsmith%2Fthewodapp%2Fpull%2F607)</sub>

<!-- cubic:review-post:ai_pr_review_1783117622083_aee75158-59a0-47fb-992b-2cc293ba1ba0:44b30a6ff9cbef41c7f9e47b43c4fec10511d0de:c41fd301-f13f-4274-9577-507c8d7b9b7b -->

</details>

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-07-07T22:49:47Z · **Actionable comments posted: 4** <details> <summary>🧹 Nitpick comments (3)</summary><blockquote...</summary>

- Author: coderabbitai[bot]
- Created: 2026-07-07T22:49:47Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#pullrequestreview-4649517204

- State: COMMENTED

**Actionable comments posted: 4**

<details>
<summary>🧹 Nitpick comments (3)</summary><blockquote>

<details>
<summary>apps/crew/src/server/crew-imports.server.ts (3)</summary><blockquote>

`286-308`: _📐 Maintainability & Code Quality_ | _🔵 Trivial_ | _⚡ Quick win_

**Duplicate/inline validation schema instead of reusing the shared one.**

This inline `z.object({ eventId: ... })` re-validates input that was already parsed against `getCrewVolunteerImportQuestionsInputSchema` at the server-fn boundary (per `apps/crew/src/server-fns/crew-import-fns.ts`). Other handlers in this file (e.g. `getCrewImportMappingSuggestion`) reuse a named exported schema constant; doing the same here avoids two schemas drifting apart.


<details>
<summary>♻️ Proposed fix</summary>

```diff
-  const data = z
-    .object({ eventId: z.string().min(1, "Event ID is required") })
-    .parse(input)
+  const data = getCrewVolunteerImportQuestionsInputSchema.parse(input)
```
</details>

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/server/crew-imports.server.ts` around lines 286 - 308, The
getCrewVolunteerImportQuestions handler is re-declaring the eventId validation
instead of reusing the shared input schema already used at the server-fn
boundary. Update getCrewVolunteerImportQuestions to use the exported schema
constant from crew-import-fns.ts, matching the pattern used by
getCrewImportMappingSuggestion, so the validation logic stays centralized and
can’t drift apart.
```

</details>

<!-- cr-comment:v1:8b10f4854205002b69d2969a -->

---

`1952-2007`: _📐 Maintainability & Code Quality_ | _🔵 Trivial_

**Duplicate column-selection shape between the two queries.**

The `select({...})` object for `competitionQuestions` and `seriesQuestions` is repeated verbatim. Extracting a shared column-selection constant would remove the duplication.

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/server/crew-imports.server.ts` around lines 1952 - 2007, The
`listVolunteerQuestionsForEvent` function repeats the same `select({...})`
column shape for both `competitionQuestions` and `seriesQuestions`; extract that
shared selection into a single reusable constant or helper and use it in both
queries. Keep the existing filtering, ordering, and `source` mapping logic
unchanged while removing the duplicated `competitionRegistrationQuestionsTable`
field list.
```

</details>

<!-- cr-comment:v1:454c625ae4a3c164a7de1282 -->

---

`772-797`: _🚀 Performance & Scalability_ | _🔵 Trivial_ | _⚖️ Poor tradeoff_

**Per-row DB round trips for answer upserts inside the transaction.**

Each answer is inserted individually with `onDuplicateKeyUpdate` in a loop, which can add up to many sequential round trips (rows × question columns) while holding the transaction open. This follows the pre-existing per-row pattern for invitations/memberships, but consider batching into a single multi-row insert (using `sql`VALUES(answer)`` for the conflict update) if import sizes grow, to shorten the transaction and reduce lock contention.

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/server/crew-imports.server.ts` around lines 772 - 797, The
volunteer answer upsert loop in the answer insertion flow is doing per-row
database writes inside the transaction, which can create many sequential round
trips and hold locks longer. Update the logic around buildVolunteerAnswerUpserts
and the client.insert(volunteerRegistrationAnswersTable) path to batch multiple
answers into a single multi-row insert with onDuplicateKeyUpdate instead of
awaiting each upsert in a loop. Keep the existing
createVolunteerRegistrationAnswerId, questionId, invitationId, and timestamp
handling, but restructure the writes so answerCount still reflects the number of
inserted/updated rows.
```

</details>

<!-- cr-comment:v1:434dbe9ef691ced04aa5bce2 -->

</blockquote></details>

</blockquote></details>

<details>
<summary>🤖 Prompt for all review comments with AI agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

Inline comments:
In `@apps/crew/src/lib/crew/imports/apply.test.ts`:
- Around line 169-277: The four new buildVolunteerApplyPlan test cases in
apply.test.ts are missing their required nearby `@lat`: references. Add exactly
one matching `@lat`: comment next to each new it() block so each test maps to its
own test-spec section, using the existing test names and buildVolunteerApplyPlan
context to place them correctly rather than relying on the file-top comment.

In `@apps/crew/src/lib/crew/imports/builtin-presets.test.ts`:
- Around line 1-229: Each of the eight `it()` test cases in
`builtin-presets.test.ts` needs its own nearby `@lat:` reference instead of
relying on the single file-level comment at the top. Move or add one matching
`@lat:` comment immediately above each individual test block in the
`describe("Built-in import presets", ...)` suite, and remove the consolidated
top-of-file reference so there is exactly one per test.

In `@apps/crew/src/lib/crew/imports/preview.test.ts`:
- Around line 50-77: Add exactly one nearby `@lat`: reference comment for each new
test case in parseCsv-related test blocks, placed directly beside the specific
it() it documents rather than at the top of the file. Update the affected test
cases in preview.test.ts, including the singular skipped-row grammar test and
the blank-header-cell rejection test, so each has its matching `@lat`: link to the
relevant test-spec section.

In `@apps/crew/src/lib/crew/imports/question-mapping.test.ts`:
- Around line 1-227: The test file currently has only one top-level `@lat`
reference, but each individual it() case needs its own nearby `@lat` comment tied
to the matching test-spec section. Add a unique `@lat` reference immediately
adjacent to each test case in question-mapping.test.ts, covering the describe
blocks around parseQuestionMappingKey, sanitizeColumnMapping,
resolveVolunteerQuestionColumns, planVolunteerQuestionColumns,
collectVolunteerQuestionsToCreate, and buildVolunteerAnswerUpserts, and remove
the file-level-only placement if it remains unused.

---

Nitpick comments:
In `@apps/crew/src/server/crew-imports.server.ts`:
- Around line 286-308: The getCrewVolunteerImportQuestions handler is
re-declaring the eventId validation instead of reusing the shared input schema
already used at the server-fn boundary. Update getCrewVolunteerImportQuestions
to use the exported schema constant from crew-import-fns.ts, matching the
pattern used by getCrewImportMappingSuggestion, so the validation logic stays
centralized and can’t drift apart.
- Around line 1952-2007: The `listVolunteerQuestionsForEvent` function repeats
the same `select({...})` column shape for both `competitionQuestions` and
`seriesQuestions`; extract that shared selection into a single reusable constant
or helper and use it in both queries. Keep the existing filtering, ordering, and
`source` mapping logic unchanged while removing the duplicated
`competitionRegistrationQuestionsTable` field list.
- Around line 772-797: The volunteer answer upsert loop in the answer insertion
flow is doing per-row database writes inside the transaction, which can create
many sequential round trips and hold locks longer. Update the logic around
buildVolunteerAnswerUpserts and the
client.insert(volunteerRegistrationAnswersTable) path to batch multiple answers
into a single multi-row insert with onDuplicateKeyUpdate instead of awaiting
each upsert in a loop. Keep the existing createVolunteerRegistrationAnswerId,
questionId, invitationId, and timestamp handling, but restructure the writes so
answerCount still reflects the number of inserted/updated rows.
```

</details>

<details>
<summary>🪄 Autofix (Beta)</summary>

Fix all unresolved CodeRabbit comments on this PR:

- [ ] <!-- {"checkboxId": "4b0d0e0a-96d7-4f10-b296-3a18ea78f0b9"} --> Push a commit to this branch (recommended)
- [ ] <!-- {"checkboxId": "ff5b1114-7d8c-49e6-8ac1-43f82af23a33"} --> Create a new PR with the fixes

</details>

---

<details>
<summary>ℹ️ Review info</summary>

<details>
<summary>⚙️ Run configuration</summary>

**Configuration used**: Path: .coderabbit.yaml

**Review profile**: CHILL

**Plan**: Pro

**Run ID**: `a2d7b2d3-1443-4d58-9d0a-94a96b4cba26`

</details>

<details>
<summary>📥 Commits</summary>

Reviewing files that changed from the base of the PR and between 53020952bba53fc0bd0fd3f0c8181ff644a2441e and 25e61018f2bdc64349156c793d0d12406afb26da.

</details>

<details>
<summary>📒 Files selected for processing (21)</summary>

* `AGENTS.md`
* `CLAUDE.md`
* `apps/crew/src/components/crew/volunteer-import-flow.tsx`
* `apps/crew/src/lib/crew/imports/apply.test.ts`
* `apps/crew/src/lib/crew/imports/apply.ts`
* `apps/crew/src/lib/crew/imports/builtin-presets.test.ts`
* `apps/crew/src/lib/crew/imports/builtin-presets.ts`
* `apps/crew/src/lib/crew/imports/column-mapping.ts`
* `apps/crew/src/lib/crew/imports/mapping-memory.ts`
* `apps/crew/src/lib/crew/imports/normalize-volunteer-row.ts`
* `apps/crew/src/lib/crew/imports/preview.test.ts`
* `apps/crew/src/lib/crew/imports/preview.ts`
* `apps/crew/src/lib/crew/imports/question-mapping.test.ts`
* `apps/crew/src/lib/crew/imports/question-mapping.ts`
* `apps/crew/src/lib/crew/imports/tabular.ts`
* `apps/crew/src/lib/crew/imports/types.ts`
* `apps/crew/src/lib/crew/imports/xlsx.ts`
* `apps/crew/src/routes/events/$eventId/heats.tsx`
* `apps/crew/src/server-fns/crew-import-fns.ts`
* `apps/crew/src/server/crew-imports.server.ts`
* `lat.md/crew.md`

</details>

<details>
<summary>🚧 Files skipped from review as they are similar to previous changes (5)</summary>

* apps/crew/src/lib/crew/imports/preview.ts
* lat.md/crew.md
* apps/crew/src/lib/crew/imports/tabular.ts
* apps/crew/src/lib/crew/imports/xlsx.ts
* apps/crew/src/routes/events/$eventId/heats.tsx

</details>

</details>

<!-- This is an auto-generated comment by CodeRabbit for review status -->

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-07T22:52:25Z · **3 issues found across 20 files (changes from recent commits).** <details> <summary>Prompt for A...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-07T22:52:25Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#pullrequestreview-4649525469

- State: COMMENTED

**3 issues found across 20 files (changes from recent commits).**

<details>
<summary>Prompt for AI agents (unresolved issues)</summary>

```text

Check if these issues are valid — if so, understand the root cause of each and fix them. If appropriate, use sub-agents to investigate and fix each issue separately.


<file name="apps/crew/src/lib/crew/imports/apply.ts">

<violation number="1" location="apps/crew/src/lib/crew/imports/apply.ts:712">
P2: Volunteer phone imports can be saved with invalid international prefixes when the mapped code is an area code, because composeSignupPhone always prepends `+` to any `phoneCountryCode`. Consider distinguishing country dial codes from area codes, or preserving area-code values as a local phone prefix instead of formatting them as E.164-like country codes.</violation>
</file>

<file name="apps/crew/src/routes/events/$eventId/heats.tsx">

<violation number="1" location="apps/crew/src/routes/events/$eventId/heats.tsx:805">
P2: A stale failed file read can clear the current heat import preview if the user selects a second file before the first parse finishes. Consider tracking a per-selection token/ref and ignoring catch/success state updates when the parsed file is no longer the latest selection.</violation>
</file>

<file name="apps/crew/src/lib/crew/imports/preview.ts">

<violation number="1" location="apps/crew/src/lib/crew/imports/preview.ts:78">
P2: Applying a volunteer import can create volunteer questions from rows that cannot be applied. Because questionAnswers are now attached to every preview row, apply should derive questions to create from rows that the apply plan will actually create/update instead of all previewRows.</violation>
</file>
```

</details>

<sub>Reply with feedback, questions, or to request a fix.<br /><br />[Re-trigger cubic](https://www.cubic.dev/action/re-review/pr/wodsmith/thewodapp/607/ai_pr_review_1783463793311_268fb2c4-bdda-4eb7-bbf9-5012a5df6904?returnTo=https%3A%2F%2Fgithub.com%2Fwodsmith%2Fthewodapp%2Fpull%2F607)</sub>

<!-- cubic:review-post:ai_pr_review_1783463793311_268fb2c4-bdda-4eb7-bbf9-5012a5df6904:25e61018f2bdc64349156c793d0d12406afb26da:9532e50c-33cb-4a28-82fc-ac2df4bde61a -->

</details>

## Inline Review Comments

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-07-03T22:26:49Z · _🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_ **Subject-verb agreement in the singular...</summary>

- Author: coderabbitai[bot]
- Created: 2026-07-03T22:26:49Z, updated 2026-07-07T22:36:49Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522031509

- Location: apps/crew/src/lib/crew/imports/tabular.ts:line 122

_🎯 Functional Correctness_ | _🟡 Minor_ | _⚡ Quick win_

**Subject-verb agreement in the singular case.**

The noun is pluralized but the verb `were` is not, producing "1 row were skipped after the preview limit."


<details>
<summary>✏️ Proposed fix</summary>

```diff
-      message: `${skippedRowCount} row${skippedRowCount === 1 ? "" : "s"} were skipped after the preview limit.`,
+      message: `${skippedRowCount} row${skippedRowCount === 1 ? "" : "s"} ${skippedRowCount === 1 ? "was" : "were"} skipped after the preview limit.`,
```
</details>

<!-- suggestion_start -->

<details>
<summary>📝 Committable suggestion</summary>

> ‼️ **IMPORTANT**
> Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

```suggestion
  if (skippedRowCount > 0) {
    fileIssues.push({
      code: "preview_row_limit",
      severity: "warning",
      message: `${skippedRowCount} row${skippedRowCount === 1 ? "" : "s"} ${skippedRowCount === 1 ? "was" : "were"} skipped after the preview limit.`,
    })
  }
```

</details>

<!-- suggestion_end -->

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/lib/crew/imports/tabular.ts` around lines 91 - 97, The
preview-limit warning in tabular import has a singular/plural grammar mismatch
in the message built in the skippedRowCount block. Update the message logic in
the code that pushes the preview_row_limit issue so the singular case uses the
correct verb form for 1 row, while keeping the plural form for skippedRowCount >
1.
```

</details>

<!-- fingerprinting:phantom:medusa:capybara -->

<!-- cr-indicator-types:potential_issue -->

<!-- cr-comment:v1:96157989a62268205d45b07f -->

<!-- This is an auto-generated comment by CodeRabbit -->

✅ Addressed in commits 44b30a6 to 25e6101

</details>

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-07-03T22:26:49Z · _🩺 Stability & Availability_ | _🟠 Major_ | _🏗️ Heavy lift_ <details> <summary>🧩 Analysis chai...</summary>

- Author: coderabbitai[bot]
- Created: 2026-07-03T22:26:49Z, updated 2026-07-07T22:36:46Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522031518

- Location: apps/crew/src/lib/crew/imports/xlsx.ts:line 50

_🩺 Stability & Availability_ | _🟠 Major_ | _🏗️ Heavy lift_

<details>
<summary>🧩 Analysis chain</summary>

🌐 Web query:

`fflate 0.8.3 streaming unzip decompressed size limit API`

💡 Result:

The fflate library (including version 0.8.3) does not implement a hard-coded decompressed size limit for its streaming APIs [1][2]. The library is designed to handle archives and streams of arbitrary size, including files larger than 4GB [1]. Key technical details regarding decompression size and limits in fflate include: 1. Streaming API Behavior: When using the streaming API (e.g., the Unzip class), data is processed in chunks via the ondata callback [3][4]. There is no internal ceiling on the total amount of data that can be processed; the library will continue to process chunks as they are pushed until the stream is finalized or terminated [3]. 2. Memory Management: While there is no explicit size limit, memory consumption depends on how the consumer handles the incoming data. If you accumulate all chunks into memory (e.g., in an array and then concatenating them), the total uncompressed size is limited only by the available memory (RAM) in your JavaScript environment [5]. 3. Buffering Options: For non-streaming, buffer-based decompression (like inflate or gunzipSync), an optional out buffer can be provided [6][7]. If this buffer is smaller than the actual decompressed data, the output will be truncated to fit the buffer size [6][7]. This is a user-defined constraint rather than a library-enforced limit [5]. 4. Version 0.8.3 Specifics: Version 0.8.3 introduced changes to the streaming callback emission pattern, where empty chunks may be emitted (e.g., with final: false or final: true) [8]. This change was intended to support new features like Z_SYNC_FLUSH and does not impose new limits on decompressed size [9]. In summary, fflate does not impose a limit on the total decompressed size [1]. If you need to manage memory for very large files, you should utilize the streaming API to process and store/discard data chunks incrementally rather than loading the entire output into memory [5][4].

Citations:

- 1: https://github.com/101arrowz/fflate/
- 2: https://www.npmjs.com/package/fflate
- 3: https://github.com/101arrowz/fflate/blob/master/docs/classes/Unzip.md
- 4: https://github.com/101arrowz/fflate/blob/master/README.md
- 5: https://github.com/101arrowz/fflate/issues/181
- 6: https://github.com/101arrowz/fflate/blob/master/docs/interfaces/InflateOptions.md
- 7: https://github.com/101arrowz/fflate/blob/master/src/index.ts
- 8: https://github.com/101arrowz/fflate/issues/265
- 9: https://github.com/101arrowz/fflate/releases/tag/v0.8.3

---

🏁 Script executed:

```shell
#!/bin/bash
set -euo pipefail

printf '\n## files\n'
git ls-files 'apps/crew/src/lib/crew/imports/xlsx.ts' 'apps/crew/src/lib/crew/imports/crew-imports.server.ts'

printf '\n## outline xlsx.ts\n'
ast-grep outline apps/crew/src/lib/crew/imports/xlsx.ts --view expanded || true

printf '\n## outline crew-imports.server.ts\n'
ast-grep outline apps/crew/src/lib/crew/imports/crew-imports.server.ts --view expanded || true

printf '\n## targeted reads\n'
for f in apps/crew/src/lib/crew/imports/xlsx.ts apps/crew/src/lib/crew/imports/crew-imports.server.ts; do
  if [ -f "$f" ]; then
    echo "--- $f ---"
    wc -l "$f"
  fi
done

printf '\n## search for MAX_CREW_IMPORT_BYTES and unzip usage\n'
rg -n "MAX_CREW_IMPORT_BYTES|unzipSync|Unzip|xlsx" apps/crew/src/lib/crew/imports -S
```

Repository: wodsmith/thewodapp

Length of output: 2751

---

🏁 Script executed:

```shell
#!/bin/bash
set -euo pipefail

printf '\n## xlsx.ts around unzip and parser entry\n'
sed -n '1,120p' apps/crew/src/lib/crew/imports/xlsx.ts

printf '\n## file.ts around import handling\n'
sed -n '1,220p' apps/crew/src/lib/crew/imports/file.ts

printf '\n## repo-wide size-limit search\n'
rg -n "MAX_CREW_IMPORT_BYTES|import size|compressed|decompressed|zip bomb|unzipSync|parseXlsx" apps -S
```

Repository: wodsmith/thewodapp

Length of output: 8362

---


</details>

**Add a decompressed-byte cap before unzipping uploads** `apps/crew/src/lib/crew/imports/xlsx.ts` calls `unzipSync` on user-supplied workbook bytes, so a small but highly-compressible `.xlsx` can still expand far beyond `MAX_CREW_IMPORT_BYTES` and stall or exhaust the server. Use streaming unzip with an aborting size counter, or enforce a limit on total inflated bytes.

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/lib/crew/imports/xlsx.ts` around lines 24 - 30, The workbook
import path in xlsx.ts unzips user-supplied bytes without limiting the inflated
size, so a compressed upload can expand past MAX_CREW_IMPORT_BYTES. Update the
import flow around unzipSync to enforce a decompressed-byte cap before or during
extraction, preferably by switching to a streaming unzip approach with an
aborting byte counter. Keep the change localized to the workbook parsing logic
that returns emptyWorkbookError on failure.
```

</details>

<!-- fingerprinting:phantom:medusa:capybara -->

<!-- cr-indicator-types:potential_issue -->

<!-- cr-comment:v1:f95e79969539edf188af7132 -->

<!-- This is an auto-generated comment by CodeRabbit -->

✅ Addressed in commits 44b30a6 to 25e6101

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=53e0164a-564c-4f52-a1fc-dfbba0974b17 --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z, updated 2026-07-07T22:37:15Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066126

- Location: apps/crew/src/lib/crew/imports/tabular.ts:line 28

<!-- cubic:v=53e0164a-564c-4f52-a1fc-dfbba0974b17 -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":9} -->
P1: Rows with partially blank header cells can pass validation but then lose data during mapping because multiple blank columns map to the same empty-string key. Consider rejecting any empty header label (not just all-empty header rows) before row mapping.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/tabular.ts, line 28:

<comment>Rows with partially blank header cells can pass validation but then lose data during mapping because multiple blank columns map to the same empty-string key. Consider rejecting any empty header label (not just all-empty header rows) before row mapping.</comment>

<file context>
@@ -0,0 +1,146 @@
+
+  if (
+    normalizedHeaders.length === 0 ||
+    normalizedHeaders.every((header) => header.length === 0)
+  ) {
+    return {
</file context>
```

</details>

✅ Addressed in [`25e6101`](https://github.com/wodsmith/thewodapp/commit/25e61018f2bdc64349156c793d0d12406afb26da)

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=3d3a6029-eb8d-4c51-a6b4-04a03f367958 --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066128

- Location: apps/crew/src/lib/crew/imports/xlsx.ts:line 30

<!-- cubic:v=3d3a6029-eb8d-4c51-a6b4-04a03f367958 -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":6} -->
P2: The decompression size cap relies on `file.originalSize` from the ZIP entry header, which is metadata declared by the file producer — it is not guaranteed to match the actual decompressed output. A crafted `.xlsx` could declare small entry sizes in its headers while compressing to much larger content, bypassing the `MAX_ENTRY_BYTES` / `MAX_TOTAL_BYTES` checks in the filter. Consider additionally checking the byte length of each decompressed entry after `unzipSync` returns (or switching to streaming decompression with an aborting counter) to defend against spoofed headers.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/xlsx.ts, line 30:

<comment>The decompression size cap relies on `file.originalSize` from the ZIP entry header, which is metadata declared by the file producer — it is not guaranteed to match the actual decompressed output. A crafted `.xlsx` could declare small entry sizes in its headers while compressing to much larger content, bypassing the `MAX_ENTRY_BYTES` / `MAX_TOTAL_BYTES` checks in the filter. Consider additionally checking the byte length of each decompressed entry after `unzipSync` returns (or switching to streaming decompression with an aborting counter) to defend against spoofed headers.</comment>

<file context>
@@ -0,0 +1,428 @@
+  let exceededSizeCap = false
+
+  try {
+    files = unzipSync(
+      input instanceof Uint8Array ? input : new Uint8Array(input),
+      {
</file context>
```

</details>

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=15a938b1-1926-4b68-9a69-1134b0ec5d29 --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066129

- Location: apps/crew/src/lib/crew/imports/xlsx.ts:line 417

<!-- cubic:v=15a938b1-1926-4b68-9a69-1134b0ec5d29 -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":8} -->
P2: A malformed numeric XML entity can throw during decode and fail the whole preview path. Guarding code points before `fromCodePoint` keeps parser behavior in the expected invalid-workbook error flow.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/xlsx.ts, line 417:

<comment>A malformed numeric XML entity can throw during decode and fail the whole preview path. Guarding code points before `fromCodePoint` keeps parser behavior in the expected invalid-workbook error flow.</comment>

<file context>
@@ -0,0 +1,428 @@
+
+function decodeXml(value: string) {
+  return value
+    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
+      String.fromCodePoint(Number.parseInt(code, 16)),
+    )
</file context>
```

</details>

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=497b2be7-3df8-4ba6-9746-c586151c00f1 --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066132

- Location: apps/crew/src/lib/crew/imports/xlsx.ts:line 136

<!-- cubic:v=497b2be7-3df8-4ba6-9746-c586151c00f1 -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":7} -->
P2: Imports can come back empty when the first workbook sheet is not a worksheet. The resolver currently follows the first `<sheet>` relationship blindly; selecting the first relationship with worksheet type would avoid skipping valid data tabs.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/xlsx.ts, line 136:

<comment>Imports can come back empty when the first workbook sheet is not a worksheet. The resolver currently follows the first `<sheet>` relationship blindly; selecting the first relationship with worksheet type would avoid skipping valid data tabs.</comment>

<file context>
@@ -0,0 +1,428 @@
+  files: Record<string, Uint8Array>,
+  workbookXml: string,
+) {
+  const sheetTag = workbookXml.match(/<sheet\b[^>]*>/)?.[0]
+  const relationshipId = sheetTag
+    ? getAttribute(sheetTag, "r:id") || getAttribute(sheetTag, "id")
</file context>
```

</details>

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=abee50a8-e23d-4304-b928-1214ffe75840 --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z, updated 2026-07-07T22:37:14Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066137

- Location: apps/crew/src/components/crew/volunteer-import-flow.tsx:line 158

<!-- cubic:v=abee50a8-e23d-4304-b928-1214ffe75840 -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":8} -->
P2: Uploading a malformed Excel file can break preview selection because parse errors are not caught in `handleFileChange`. Wrapping `parseCrewImportFile` in `try/catch` and resetting preview state with a toast keeps the form usable when workbook parsing fails.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/components/crew/volunteer-import-flow.tsx, line 158:

<comment>Uploading a malformed Excel file can break preview selection because parse errors are not caught in `handleFileChange`. Wrapping `parseCrewImportFile` in `try/catch` and resetting preview state with a toast keeps the form usable when workbook parsing fails.</comment>

<file context>
@@ -152,10 +155,17 @@ function VolunteerUploadPanel({
-    setHeaders(csv.headers)
-    setMapping(inferColumnMapping(csv.headers, kind))
-    setClientIssues(csv.fileIssues)
+    const parsed = parseCrewImportFile(
+      {
+        filename: selectedFile.name,
</file context>
```

</details>

✅ Addressed in [`25e6101`](https://github.com/wodsmith/thewodapp/commit/25e61018f2bdc64349156c793d0d12406afb26da)

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=af19afee-18ff-4a48-9046-829a7586c563 --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z, updated 2026-07-07T22:37:13Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066140

- Location: apps/crew/src/routes/events/$eventId/heats.tsx:line 791

<!-- cubic:v=af19afee-18ff-4a48-9046-829a7586c563 -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":7} -->
P2: A malformed Excel file can break the upload preview flow instead of showing a file issue because client-side parsing is called without a local try/catch. Wrapping `parseCrewImportFile` here and surfacing a user-facing parse error would keep the dialog recoverable for bad workbook content.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/routes/events/$eventId/heats.tsx, line 791:

<comment>A malformed Excel file can break the upload preview flow instead of showing a file issue because client-side parsing is called without a local try/catch. Wrapping `parseCrewImportFile` here and surfacing a user-facing parse error would keep the dialog recoverable for bad workbook content.</comment>

<file context>
@@ -780,10 +788,17 @@ function HeatImportUploadPanel({
-    setHeaders(csv.headers)
-    setMapping(inferColumnMapping(csv.headers, "heat_schedule"))
-    setClientIssues(csv.fileIssues)
+    const parsed = parseCrewImportFile(
+      {
+        filename: selectedFile.name,
</file context>
```

</details>

✅ Addressed in [`25e6101`](https://github.com/wodsmith/thewodapp/commit/25e61018f2bdc64349156c793d0d12406afb26da)

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=8d2e7302-8e78-4d3a-b293-d144ae5defde --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066142

- Location: AGENTS.md:line 153

<!-- cubic:v=8d2e7302-8e78-4d3a-b293-d144ae5defde -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":9} -->
P2: The 43-line GitNexus configuration block is duplicated verbatim across `AGENTS.md` and `CLAUDE.md`. These files serve different AI tool audiences, but the GitNexus content is identical. If tool commands, parameters, or workflow steps need updating in the future (e.g., a new parameter for `gitnexus_impact` or an additional pre-commit check), both files must be kept in sync. Consider extracting the shared GitNexus content into a single source and referencing it from each file, or adding a maintenance note in one of the files to remind contributors to update both when this section changes.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At AGENTS.md, line 153:

<comment>The 43-line GitNexus configuration block is duplicated verbatim across `AGENTS.md` and `CLAUDE.md`. These files serve different AI tool audiences, but the GitNexus content is identical. If tool commands, parameters, or workflow steps need updating in the future (e.g., a new parameter for `gitnexus_impact` or an additional pre-commit check), both files must be kept in sync. Consider extracting the shared GitNexus content into a single source and referencing it from each file, or adding a maintenance note in one of the files to remind contributors to update both when this section changes.</comment>

<file context>
@@ -149,3 +149,47 @@ The CRM document panel also exposes DOM hints:
 - `data-agent-preferred-action="uploadCrmDocument"` on the upload form.
 - `data-agent-api="/api/crm/documents"` on the upload form.
+
+<!-- gitnexus:start -->
+# GitNexus — Code Intelligence
+
</file context>
```

</details>

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=7f22d8e4-0b5f-412e-866e-5b312fdf29fd --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066143

- Location: apps/crew/src/lib/crew/imports/xlsx.ts:line 344

<!-- cubic:v=7f22d8e4-0b5f-412e-866e-5b312fdf29fd -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":8} -->
P2: Time and dateTime formatting discards the seconds component of serial date/time values, causing data loss for cells with second-level precision (e.g., 14:30:45 becomes "2:30 PM"). The `secondsIntoDay` variable is computed on line 339 but neither `formatClockTime` nor the dateTime format string include seconds. For heat schedule imports where organizers may provide exact start times, this silently drops precision. Consider adding seconds to the output, at least for the dateTime format where the label suggests full precision.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/xlsx.ts, line 344:

<comment>Time and dateTime formatting discards the seconds component of serial date/time values, causing data loss for cells with second-level precision (e.g., 14:30:45 becomes "2:30 PM"). The `secondsIntoDay` variable is computed on line 339 but neither `formatClockTime` nor the dateTime format string include seconds. For heat schedule imports where organizers may provide exact start times, this silently drops precision. Consider adding seconds to the output, at least for the dateTime format where the label suggests full precision.</comment>

<file context>
@@ -0,0 +1,428 @@
+  const hours = Math.floor(secondsIntoDay / 3600)
+  const minutes = Math.floor((secondsIntoDay % 3600) / 60)
+
+  if (styleKind === "time") return formatClockTime(hours, minutes)
+
+  const datePart = [
</file context>
```

</details>

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=0fe05226-32ac-43b6-8a01-424c8d31e492 --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066145

- Location: apps/crew/src/lib/crew/imports/preview.test.ts:line 324

<!-- cubic:v=0fe05226-32ac-43b6-8a01-424c8d31e492 -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":8} -->
P2: The test uses `numFmtId="20"` but expects 12-hour AM/PM output. Per the OOXML spec, numFmtId 20 is `h:mm` (24-hour, no AM/PM), and numFmtId 18 is `h:mm AM/PM` (12-hour). Use `numFmtId="18"` here so the format ID correctly corresponds to the expected "9:00 AM" output. This prevents a latent correctness issue from turning into a test failure if the parser later distinguishes 24-hour vs 12-hour time formats.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/preview.test.ts, line 225:

<comment>The test uses `numFmtId="20"` but expects 12-hour AM/PM output. Per the OOXML spec, numFmtId 20 is `h:mm` (24-hour, no AM/PM), and numFmtId 18 is `h:mm AM/PM` (12-hour). Use `numFmtId="18"` here so the format ID correctly corresponds to the expected "9:00 AM" output. This prevents a latent correctness issue from turning into a test failure if the parser later distinguishes 24-hour vs 12-hour time formats.</comment>

<file context>
@@ -166,4 +182,275 @@ describe("buildCrewImportPreview", () => {
+          '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
+          '<cellXfs count="2">',
+          '<xf numFmtId="0" applyNumberFormat="0"/>',
+          '<xf numFmtId="20" applyNumberFormat="1"/>',
+          "</cellXfs>",
+          "</styleSheet>",
</file context>
```

</details>

```suggestion
          '<xf numFmtId="18" applyNumberFormat="1"/>',
```

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=8cc93684-c2b2-4df0-8fc7-05b110ed161c --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z, updated 2026-07-07T22:37:16Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066151

- Location: apps/crew/src/lib/crew/imports/types.ts:line 31

<!-- cubic:v=8cc93684-c2b2-4df0-8fc7-05b110ed161c -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":10} -->
P3: The `ImportFileRecord` and `ImportFileParseResult` type aliases are exported but never imported or referenced anywhere in the codebase. They appear to be forward-facing re-exports intended for external consumers, but are unused across all files in the `apps/crew` directory. If these are meant for future use, consider adding a comment or waiting until they are consumed. Otherwise they add noise to the public type surface and may drift out of sync with the actual types.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/types.ts, line 31:

<comment>The `ImportFileRecord` and `ImportFileParseResult` type aliases are exported but never imported or referenced anywhere in the codebase. They appear to be forward-facing re-exports intended for external consumers, but are unused across all files in the `apps/crew` directory. If these are meant for future use, consider adding a comment or waiting until they are consumed. Otherwise they add noise to the public type surface and may drift out of sync with the actual types.</comment>

<file context>
@@ -28,6 +28,9 @@ export interface CsvParseResult {
   skippedRowCount: number
 }
 
+export type ImportFileRecord = CsvRecord
+export type ImportFileParseResult = CsvParseResult
+
</file context>
```

</details>

✅ Addressed in [`25e6101`](https://github.com/wodsmith/thewodapp/commit/25e61018f2bdc64349156c793d0d12406afb26da)

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-03T22:38:07Z · <!-- cubic:v=cc983b23-2234-4f3b-b6d3-b2be23981da6 --> <!-- cubic:review-run=c41fd301-f13f-4274-95...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-03T22:38:07Z, updated 2026-07-07T22:37:17Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3522066153

- Location: apps/crew/src/lib/crew/imports/tabular.ts:line 95

<!-- cubic:v=cc983b23-2234-4f3b-b6d3-b2be23981da6 -->
<!-- cubic:review-run=c41fd301-f13f-4274-9577-507c8d7b9b7b -->
<!-- metadata:{"confidence":10} -->
P3: Subject-verb agreement is incorrect when `skippedRowCount` is 1 — the message will read "1 row were skipped" instead of "1 row was skipped". The verb should be conditional on the count to match the noun.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/tabular.ts, line 95:

<comment>Subject-verb agreement is incorrect when `skippedRowCount` is 1 — the message will read "1 row were skipped" instead of "1 row was skipped". The verb should be conditional on the count to match the noun.</comment>

<file context>
@@ -0,0 +1,146 @@
+    fileIssues.push({
+      code: "preview_row_limit",
+      severity: "warning",
+      message: `${skippedRowCount} row${skippedRowCount === 1 ? "" : "s"} were skipped after the preview limit.`,
+    })
+  }
</file context>
```

</details>

✅ Addressed in [`25e6101`](https://github.com/wodsmith/thewodapp/commit/25e61018f2bdc64349156c793d0d12406afb26da)

</details>

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-07-07T22:49:46Z · _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Add per-test `@lat:` reference...</summary>

- Author: coderabbitai[bot]
- Created: 2026-07-07T22:49:46Z, updated 2026-07-07T22:49:47Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3540131105

- Location: apps/crew/src/lib/crew/imports/apply.test.ts:line 277

_📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_

**Add per-test `@lat:` references for these new cases.**

Four new `it()` blocks are added here with no nearby `@lat:` reference (only the pre-existing file-top comment applies). Per the coding guideline, each test case should carry its own reference next to it.


As per coding guidelines: "Each test case in code must include exactly one nearby `@lat:` reference to the matching test-spec section, and the comment must be placed next to the relevant test rather than at the top of the file."

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/lib/crew/imports/apply.test.ts` around lines 169 - 277, The
four new buildVolunteerApplyPlan test cases in apply.test.ts are missing their
required nearby `@lat`: references. Add exactly one matching `@lat`: comment next to
each new it() block so each test maps to its own test-spec section, using the
existing test names and buildVolunteerApplyPlan context to place them correctly
rather than relying on the file-top comment.
```

</details>

<!-- fingerprinting:phantom:poseidon:beignet -->

<!-- cr-indicator-types:refactor_suggestion -->

<!-- cr-comment:v1:1810e380f7b1c61acd4bdfcd -->

_Source: Coding guidelines_

<!-- This is an auto-generated comment by CodeRabbit -->

</details>

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-07-07T22:49:46Z · _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Missing per-test `@lat:` refer...</summary>

- Author: coderabbitai[bot]
- Created: 2026-07-07T22:49:46Z, updated 2026-07-07T22:49:47Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3540131109

- Location: apps/crew/src/lib/crew/imports/builtin-presets.test.ts:line 229

_📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_

**Missing per-test `@lat:` references.**

This file has a single `@lat:` comment at the top (Line 1) covering all 8 `it()` blocks. Per the coding guideline, each test case must have exactly one `@lat:` reference placed next to that specific test, not consolidated at the top.

<details>
<summary>📝 Example fix pattern</summary>

```diff
-// `@lat`: [[crew#Remember Import Mappings#Built-in Presets]]
 import { describe, expect, it } from "vitest"
...
 describe("Built-in import presets", () => {
+  // `@lat`: [[crew#Remember Import Mappings#Built-in Presets#Matches all fields]]
   it("maps all 20 Competition Corner columns, including newQuestion keys", () => {
     ...
   })

+  // `@lat`: [[crew#Remember Import Mappings#Built-in Presets#Sanitized keys]]
   it("keeps question-namespaced keys valid after sanitization", () => {
     ...
   })
   // ...repeat for each remaining `it()` block
```
</details>

As per coding guidelines, "Each test case in code must include exactly one nearby `@lat:` reference to the matching test-spec section, and the comment must be placed next to the relevant test rather than at the top of the file."

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/lib/crew/imports/builtin-presets.test.ts` around lines 1 - 229,
Each of the eight `it()` test cases in `builtin-presets.test.ts` needs its own
nearby `@lat:` reference instead of relying on the single file-level comment at
the top. Move or add one matching `@lat:` comment immediately above each
individual test block in the `describe("Built-in import presets", ...)` suite,
and remove the consolidated top-of-file reference so there is exactly one per
test.
```

</details>

<!-- fingerprinting:phantom:poseidon:beignet -->

<!-- cr-indicator-types:refactor_suggestion -->

<!-- cr-comment:v1:9a6010c9ee3c38e5bdca8c64 -->

_Source: Coding guidelines_

<!-- This is an auto-generated comment by CodeRabbit -->

</details>

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-07-07T22:49:46Z · _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Missing per-test `@lat:` refer...</summary>

- Author: coderabbitai[bot]
- Created: 2026-07-07T22:49:46Z, updated 2026-07-07T22:49:47Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3540131110

- Location: apps/crew/src/lib/crew/imports/preview.test.ts:line 77

_📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_

**Missing per-test `@lat:` references.**

These newly added test cases don't have a nearby `@lat:` reference placed next to each test, as required by the coding guideline.

As per coding guidelines, "Each test case in code must include exactly one nearby `@lat:` reference to the matching test-spec section, and the comment must be placed next to the relevant test rather than at the top of the file."


Also applies to: 139-207, 361-430

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/lib/crew/imports/preview.test.ts` around lines 50 - 77, Add
exactly one nearby `@lat`: reference comment for each new test case in
parseCsv-related test blocks, placed directly beside the specific it() it
documents rather than at the top of the file. Update the affected test cases in
preview.test.ts, including the singular skipped-row grammar test and the
blank-header-cell rejection test, so each has its matching `@lat`: link to the
relevant test-spec section.
```

</details>

<!-- fingerprinting:phantom:poseidon:beignet -->

<!-- cr-indicator-types:refactor_suggestion -->

<!-- cr-comment:v1:83536659e2ca1588ce0dfdb4 -->

_Source: Coding guidelines_

<!-- This is an auto-generated comment by CodeRabbit -->

</details>

<details>
<summary><strong>coderabbitai[bot]</strong> · 2026-07-07T22:49:47Z · _📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_ **Add a `@lat:` reference next t...</summary>

- Author: coderabbitai[bot]
- Created: 2026-07-07T22:49:47Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3540131112

- Location: apps/crew/src/lib/crew/imports/question-mapping.test.ts:line 227

_📐 Maintainability & Code Quality_ | _🟠 Major_ | _⚡ Quick win_

**Add a `@lat:` reference next to each test case, not just once at the top.**

This file defines 9 separate `it()` cases across 6 `describe()` blocks but has only a single `// `@lat`:` comment at line 1. Per the coding guideline, each test case needs its own nearby `@lat:` reference to the matching test-spec section.


As per coding guidelines: "Each test case in code must include exactly one nearby `@lat:` reference to the matching test-spec section, and the comment must be placed next to the relevant test rather than at the top of the file."

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@apps/crew/src/lib/crew/imports/question-mapping.test.ts` around lines 1 -
227, The test file currently has only one top-level `@lat` reference, but each
individual it() case needs its own nearby `@lat` comment tied to the matching
test-spec section. Add a unique `@lat` reference immediately adjacent to each test
case in question-mapping.test.ts, covering the describe blocks around
parseQuestionMappingKey, sanitizeColumnMapping, resolveVolunteerQuestionColumns,
planVolunteerQuestionColumns, collectVolunteerQuestionsToCreate, and
buildVolunteerAnswerUpserts, and remove the file-level-only placement if it
remains unused.
```

</details>

<!-- fingerprinting:phantom:poseidon:beignet -->

<!-- cr-indicator-types:refactor_suggestion -->

<!-- cr-comment:v1:12bf60c4157413489aebca1f -->

_Source: Coding guidelines_

<!-- This is an auto-generated comment by CodeRabbit -->

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-07T22:52:25Z · <!-- cubic:v=f250712c-3787-410b-9198-6ad3b701f6ae --> <!-- cubic:review-run=9532e50c-33cb-4a28-82...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-07T22:52:25Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3540139459

- Location: apps/crew/src/lib/crew/imports/apply.ts:line 712

<!-- cubic:v=f250712c-3787-410b-9198-6ad3b701f6ae -->
<!-- cubic:review-run=9532e50c-33cb-4a28-82fc-ac2df4bde61a -->
<!-- metadata:{"confidence":7} -->
P2: Volunteer phone imports can be saved with invalid international prefixes when the mapped code is an area code, because composeSignupPhone always prepends `+` to any `phoneCountryCode`. Consider distinguishing country dial codes from area codes, or preserving area-code values as a local phone prefix instead of formatting them as E.164-like country codes.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/apply.ts, line 712:

<comment>Volunteer phone imports can be saved with invalid international prefixes when the mapped code is an area code, because composeSignupPhone always prepends `+` to any `phoneCountryCode`. Consider distinguishing country dial codes from area codes, or preserving area-code values as a local phone prefix instead of formatting them as E.164-like country codes.</comment>

<file context>
@@ -653,28 +653,77 @@ function buildVolunteerImportMetadata(
+  const codeDigits = code.replace(/^\+/, "")
+  if (number.startsWith(codeDigits)) return number
+
+  return `+${codeDigits} ${number}`
+}
+
</file context>
```

</details>

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-07T22:52:25Z · <!-- cubic:v=da46aff6-e4f1-48d4-8c9b-1f72c8db88bd --> <!-- cubic:review-run=9532e50c-33cb-4a28-82...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-07T22:52:25Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3540139464

- Location: apps/crew/src/routes/events/$eventId/heats.tsx:line 805

<!-- cubic:v=da46aff6-e4f1-48d4-8c9b-1f72c8db88bd -->
<!-- cubic:review-run=9532e50c-33cb-4a28-82fc-ac2df4bde61a -->
<!-- metadata:{"confidence":7} -->
P2: A stale failed file read can clear the current heat import preview if the user selects a second file before the first parse finishes. Consider tracking a per-selection token/ref and ignoring catch/success state updates when the parsed file is no longer the latest selection.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/routes/events/$eventId/heats.tsx, line 805:

<comment>A stale failed file read can clear the current heat import preview if the user selects a second file before the first parse finishes. Consider tracking a per-selection token/ref and ignoring catch/success state updates when the parsed file is no longer the latest selection.</comment>

<file context>
@@ -788,14 +788,24 @@ function HeatImportUploadPanel({
+      setHeaders([])
+      setMapping({})
+      setMappingSuggestion(null)
+      setClientIssues([buildClientFileParseIssue()])
+      return
+    }
</file context>
```

</details>

</details>

<details>
<summary><strong>cubic-dev-ai[bot]</strong> · 2026-07-07T22:52:25Z · <!-- cubic:v=2a80a351-2f2b-4e72-8718-ccab7cacab91 --> <!-- cubic:review-run=9532e50c-33cb-4a28-82...</summary>

- Author: cubic-dev-ai[bot]
- Created: 2026-07-07T22:52:25Z
- URL: https://github.com/wodsmith/thewodapp/pull/607#discussion_r3540139467

- Location: apps/crew/src/lib/crew/imports/preview.ts:line 78

<!-- cubic:v=2a80a351-2f2b-4e72-8718-ccab7cacab91 -->
<!-- cubic:review-run=9532e50c-33cb-4a28-82fc-ac2df4bde61a -->
<!-- metadata:{"confidence":8} -->
P2: Applying a volunteer import can create volunteer questions from rows that cannot be applied. Because questionAnswers are now attached to every preview row, apply should derive questions to create from rows that the apply plan will actually create/update instead of all previewRows.

<details>
<summary>Prompt for AI agents</summary>

```text
Check if this issue is valid — if so, understand the root cause and fix it. At apps/crew/src/lib/crew/imports/preview.ts, line 78:

<comment>Applying a volunteer import can create volunteer questions from rows that cannot be applied. Because questionAnswers are now attached to every preview row, apply should derive questions to create from rows that the apply plan will actually create/update instead of all previewRows.</comment>

<file context>
@@ -58,13 +64,35 @@ export function buildCrewImportPreview({
+  const questionPlan =
+    kind === "volunteers"
+      ? planVolunteerQuestionColumns(
+          resolvedQuestionColumns,
+          parsed.rows.map((record) => record.values),
+        )
</file context>
```

</details>

</details>
