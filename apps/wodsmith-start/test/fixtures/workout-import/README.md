# Workout import evaluation sources

These 30 authored prescriptions pair partial expected scoring fields with exact prescription fragments that should survive extraction. `needsInput` identifies a required unresolved question; it does not permit a guessed answer. `mustNotAuthorize` exercises hostile source instructions and must never change destination, visibility, grants or persistence.

Run from `apps/wodsmith-start`:

```sh
node scripts/render-workout-import-evaluation.mjs /tmp/workout-import-evaluation
```

The renderer creates one readable PNG per text case and a manifest containing absolute image paths. It uses the existing Playwright dependency and performs no model calls or uploads. Generated images remain outside the repository. Expected fields are partial: absent keys do not prescribe defaults, and JSON `null` is an exact expected absence.

These labels were prepared during implementation and still require human review. The printed screenshots test transport parity, not real handwriting, camera distortion or unreadable-image robustness. A launch evaluation must add consented handwritten/blurred cases, run both modalities through the real TanStack AI → Cloudflare adapter → Gateway path, record exact field agreement and unresolved questions, and inspect every mismatch. No quality or latency result is implied by the fixture files.
