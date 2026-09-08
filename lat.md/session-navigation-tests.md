---
lat:
  require-code-mention: true
---
# Session navigation and addition intent tests

These regressions preserve return navigation, distinguish addition identities and keep preview persistence faithful to the session API.

## Personal log return context

New and edited personal library scores retain the selected workspace, date, non-default track and personal surface without confusing return context with source provenance.

## Imported workout return context is not provenance

A track-origin import retains its return destination and recognized notes while the new workout remains independent of the previous workout's source track and date.

## Addition cache scopes occurrence identity

Add-all retries reuse identity within a destination and source occurrence; changing workspace, date or source track creates a different identity, and returning restores the original intent.

## Preview append identity contract

The preview rejects reused IDs with different payloads, deduplicates normal occurrences and recognizes explicit-repeat retries without deduplicating distinct repeat identities.

## Preview state persists through reload

Session contents, private block results and the default track survive native reload together, preventing a partially persisted training day.

## Preview responses cannot mutate persisted state

Returned session snapshots are detached from preview backing state on ordinary reads and duplicate appends, matching serialized server responses.

## Real append context and retry contract

The real server preserves distinct source dates and destination days, rejects conflicting reused IDs, and accepts identical ordinary and explicit-repeat retries without another insertion.

## Personal score browser return journey

Native My session new-score and edit-score links return to the browsed non-default track, workspace, date and personal surface after saving.

## Preview private completion and default reload

The browser retains a private completion borrowed from another date and loads the saved default when reopening Training without a track query.

## Existing score redirect preserves return navigation

When a personal new-log link resolves an existing result, its edit redirect preserves the selected return track, workspace, date and surface.
