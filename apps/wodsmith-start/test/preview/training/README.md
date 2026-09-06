# Training component preview

This local preview mounts the real athlete and coach React components with illustrative API fixtures. All preview writes stay in browser storage. It does not exercise authentication, server functions, or the database.

From the repository root:

```sh
pnpm --filter wodsmith-start exec vite --config test/preview/training/vite.config.ts
```

Open `http://127.0.0.1:8766/training` or `/training/programming`. The fixture creates today's session in the gym timezone. Athlete results, draft changes, publication, and copying persist in the browser. Clear the `wodsmith-training-component-preview-v1` localStorage key to reset the fixture.

Production routes do not import these fixtures. The Vite alias is confined to this preview configuration; the normal application calls authenticated training server functions.
