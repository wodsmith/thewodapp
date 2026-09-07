# Training component preview

This local preview mounts the real athlete and coach React components with illustrative API fixtures. All preview writes stay in browser storage. It does not exercise authentication, server functions, or the database.

From the repository root:

```sh
pnpm --filter wodsmith-start exec vite --config test/preview/training/vite.config.ts
```

Open `http://127.0.0.1:8766/training` or `/training/programming`. `/compete-reference` mounts the production Compete creation dialog for comparison with the shared programmer fields. The fixture creates today's session in the gym timezone. Athlete results, draft changes, publication, and copying persist in the browser. Clear the `wodsmith-training-component-preview-v1` localStorage key to reset the fixture.

Production routes do not import these fixtures. The Vite alias is confined to this preview configuration; the normal application calls authenticated training server functions.

## Track and provider preview

The track preview mounts the production reader, importer controls, and athlete Training components with in-memory fixtures. The banner identifies illustrative data; these pages make no production writes.

```sh
pnpm --filter wodsmith-start exec vite --config test/preview/training/vite.track.config.ts
```

Open `http://127.0.0.1:8767/programming/ptrk_crossfit_dotcom?admin=1&date=2026-09-04` for a multi-score day, or choose September 6 for rest. Omit `admin=1` for the ordinary reader. Import controls are at `/admin/programming/ptrk_crossfit_dotcom`; Training is at `/training?date=2026-09-04`. Reloading resets this preview's in-memory state. Production authorization and persistence are verified separately by the server and disposable-MySQL tests.

Personal additions in the track preview share one workspace/date session and result store, including private history after removal. Library score links lead to `/log/new`, which this fixture does not render; real rich-library result persistence is covered by the disposable-MySQL suite. Admin fixture publishes appear in fixture history and exact-date reads.
