# Workout import model comparison

Synthetic local Worker requests compared GLM-5.3 and DeepSeek V4 Flash using the exact deployed inference prompt, schema, 4,096-output-token bound, low reasoning effort and 90-second deadline from main `8129eab5`.

## Baseline results

One request per model and fixture establishes a bounded diagnostic, not representative accuracy. Core checks cover scoring scheme, cap seconds, number of recorded results, prescription preservation and actual score-sort direction.

| Fixture | GLM-5.3 | DeepSeek V4 Flash |
| --- | --- | --- |
| Three rounds for one total time | Wrong rounds-reps / first; 4.764s; 336 input / 177 output tokens | Correct time / min; 13.815s; 336 / 974 tokens |
| 100 burpees, 15-minute cap | Wrong reps / max; cap held by validator; 5.291s; 339 / 184 tokens | Unknown scheme; cap held by validator; 38.925s; 339 / 2,925 tokens |
| Seven-minute burpee AMRAP, total reps | Correct reps / sum with descending default; 4.797s; 329 / 162 tokens | Wrong time / max; 12.723s; 330 / 772 tokens |

Both models passed one of three core scoring cases. All requests used one dispatch, preserved the prescription, and produced parseable structured output. The empty movement catalog intentionally generated movement-match questions. A valid schema did not establish correct scoring.

Models: `@cf/zai-org/glm-5.3` and `@cf/deepseek-ai/deepseek-v4-flash-0731`. DeepSeek received no model-specific prompt tuning. Earlier GLM prompt experiments were excluded from this comparison.

## DeepSeek V4 Pro baseline

The native Workers AI model `@cf/deepseek-ai/deepseek-v4-pro-0813` received the same baseline prompt and options, with no model-specific tuning. It passed zero of three core cases.

| Fixture | Result | Latency | Input / output tokens |
| --- | --- | --- | --- |
| Ordinary time | Unknown scheme, max direction | 53.665 s | 336 / 3,496 |
| Capped time | Unknown scheme, cap held, max direction | 50.337 s | 339 / 2,991 |
| Total-rep AMRAP | Unknown scheme and recorded-result count | 32.122 s | 330 / 2,014 |

All three used one dispatch. Official model documentation: https://developers.cloudflare.com/workers-ai/models/deepseek-v4-pro-0813/ .

## Visible field contract comparison

The same three fixtures were repeated with shared field definitions and JSON schema generated from the exact validation schema added to system context. Model options and runtime bounds remained unchanged.

| Model | Core results | Ordinary time | Capped time | AMRAP |
| --- | --- | --- | --- | --- |
| GLM-5.3 | 3/3 | 6.763 s, 1 call | 6.312 s, 1 call | 5.772 s, 1 call |
| DeepSeek V4 Flash | 3/3 | 18.236 s, 1 call | 15.292 s, 1 call | 66.779 s, 2 calls |
| DeepSeek V4 Pro | 2/3 | 14.627 s, 1 call | 79.344 s, 2 calls | 11.007 s, 1 call; missing recorded-result count |

GLM was fastest and passed all core cases in this small diagnostic. The repair cases show why latency and actual dispatch count matter alongside final structured validity. Usage reported by the baseline inference callback reflects the last completed model call, so it must not be read as cumulative usage for repair cases. Local artifacts: `/tmp/workout-import-model-comparison-context/`.

These core checks do not assert every optional scoring field. A separate GLM pipeline text trial invented a reps tiebreak; the final draft adds explicit tiebreak and reps-per-round field definitions. That later addition is not included in the table above.

## Provider reasoning

The local diagnostic captured only provider-returned SSE `reasoning_content` or `reasoning`, output text, finish reasons and usage for synthetic fixtures. Production logging and Gateway privacy settings were unchanged.

DeepSeek repeatedly stated that it did not know the exact schema, guessed that `scoreType` represented time or reps, and guessed an AMRAP scheme rather than using the legal schema values. Returned reasoning was 2,570–11,207 characters; GLM exposed only 7–45 characters. The traces support supplying a visible field contract, but do not prove the transport's hidden conditioning implementation.

## Image transcription isolation

The same clear 900×236 PNG and identical transcription prompt were sent to GLM-5.3 Flash with and without structured output. The text request did not disclose the image's answer.

Raw text output transcribed the complete header and prescription in 1.486 seconds (392 input / 30 output tokens). Structured output returned only the header in 1.561 seconds (392 / 26 tokens), reporting readable=true and no uncertainty. Both finished normally; neither exposed reasoning. This isolates an output-mode difference on this sample, not an unreadable source.

The 17,870-byte image SHA-256 was `d41a1acccb6756ec7b0c96d29a48f9acd8184c4bc3d8caa1e2f5f205df20a5a1`. Local diagnostic artifacts are under `/tmp/workout-import-model-comparison/`; the rendered image is `/tmp/workout-import-evaluation/time-cap-fifteen.png`.

## Revised image pipeline

A raw Flash transcription followed by schema-visible GLM preserved the complete PNG prescription and produced time-with-cap, 900 seconds and one recorded result in 7.687 seconds, using two calls and cumulative 1,597 input / 210 output tokens. Only the expected catalog-match question remained. Raw transcription is length-bounded locally and unreadable markers remain mandatory review questions.

## Broader GLM verification

The completed field contract was checked once against the existing 30-fixture text corpus and three clear PNG fixtures. It passed 27/30 text cases and 3/3 image cases; this is a bounded authored corpus, not a general accuracy estimate.

All required preservation checks passed and no unsupported tiebreak appeared. Text failures were an assumed single recorded result for ambiguous lifting sets, an unnecessary cap clarification for ordinary timed intervals, and invented pounds for a load whose units were absent. The last case also omitted the required missing-unit question.

Images covered capped time (9.045 s), ambiguous EMOM (8.500 s), and Rx/scaled prescriptions (8.201 s). Each used exactly two dispatches and retained expected clarifications. Local artifacts are `/tmp/workout-import-glm-corpus/`.

## Reasoning setting verification

One consolidated source-evidence clarification fixed the initial unit hallucination, but low effort still classified missing units as an optional warning and asked an unnecessary recorded-result question for capped time. The focused recheck passed 8/10 cases.

The identical prompt with GLM medium reasoning effort passed all five bounded diagnostic cases: missing units with a required question (15.377 s), ambiguous lifting sets (50.568 s), timed intervals (40.676 s), capped time (17.055 s), and total-rep AMRAP (32.913 s). All used one dispatch. This motivated a full medium-effort candidate run; the 90-second deadline, 4,096 output tokens and two-dispatch limit remain unchanged.

OCR explicitly rejects length-limited, filtered or incomplete terminal status. The installed adapter synthesizes stop if no provider finish reason is sent, so middleware cannot identify that missing-status case. No custom SSE parser or production reasoning logs were introduced.

## Medium-effort full corpus and timeout diagnosis

The unchanged 30-text/three-image medium run returned 24 correct text proposals, six safe 90-second text timeouts, one correct image proposal and two image invalid-output failures after 72.680 and 78.355 seconds. All completed proposals passed the scored checks. Text median latency including failures was 27.262 seconds; image median was 72.680 seconds. This reliability was unsuitable for release.

One diagnostic replay of the single-max-lift timeout captured the first response ending with finish_reason=length at exactly 4,096 completion tokens: 18,120 provider-returned reasoning characters and zero JSON output. The second dispatch hit the run deadline. This directly demonstrates reasoning exhausting the configured output budget for that replay. The runtime budgets were not raised.

## Classified source cautions

The final candidate returns to low reasoning effort. Internal warning items carry suggested_name or source_ambiguity; source ambiguities also identify the affected existing question field. The resolver converts them into required questions regardless of message wording and strips internal metadata before the public proposal. Suggested names remain optional warnings. Public schemas and UI remain unchanged.

The installed adapter rejects oneOf from Zod discriminatedUnion. An equivalent tagged z.union emits supported anyOf and passes the actual-adapter runtime suite. The aborted compatibility attempt dispatched no text proposal calls; its three image transcription calls are not model-quality results.

## Final low-effort classified corpus

The final actual pipeline passed 28/30 text expectations and 3/3 screenshot expectations. All 33 requests succeeded: every text used one dispatch and every image used two. Text latency ranged from 3.281 to 9.818 seconds (median 5.252); screenshots took 7.311, 7.396 and 10.703 seconds. No timeouts, token-limit failures, invented units or unsupported tiebreaks occurred in this run.

Two text expectations still failed. Total-rep AMRAP conservatively left roundsToScore unknown and asked a review question. The unitless 135/95 load remained verbatim and unmodified, but the model omitted both a missing-unit question and a source-ambiguity warning. Deterministic warning routing cannot recover an ambiguity the model never emits. This limitation must not be presented as a complete accuracy pass.

The screenshots covered capped time, ambiguous EMOM and Rx/scaled prescriptions, including complete raw transcription and required clarifications. Local final artifacts: `/tmp/workout-import-glm-low-classified-corpus/`. The authored corpus and this report preserve failed variants as diagnostic history rather than hiding them.

Validation: 39 runtime tests pass, including actual-adapter SSE transport, source-warning classification independent of wording, OCR termination/size bounds, shared authorization and dispatch budget, and combined-source recovery. Application type checking, repository documentation checks and diff whitespace checks pass. The full application suite passed 3,468 tests (88 skipped) before the final internal warning change; the directly affected runtime suite was rerun afterward.

## Release boundary

The model change remains uncommitted and undeployed while these findings are resolved. Production continues using the previously deployed model. No production sessions, workout writes, schema changes or entitlement changes were performed by this comparison.
