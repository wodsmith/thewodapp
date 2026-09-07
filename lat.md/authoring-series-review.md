# Series Authoring Review

Series creation preserves the definition selected in shared workout fields, and creation callbacks distinguish failed persistence from failed refreshes after success.

## Series dialog preserves selected fields

The real series dialog passes selected rounds, tiebreak, and movements through its parent callback. Failed creation retains those choices for retry instead of dropping them at the adapter boundary.

## Series creation stores selected fields atomically

The server validates rounds, tiebreak, and movement IDs, then stores the workout definition, track link, and movement links in the same transaction. Duplicate movement IDs create only one link per movement.

## Organizer refresh failure follows successful creation

Organizer and cohost creation reset a successfully persisted draft even when router refresh fails. A refresh rejection identifies that creation succeeded without making the event retryable or emitting creation-failure analytics.

## Series reads retain scoring definitions

Template list and detail reads project rounds and tiebreak metadata so an unrelated edit cannot silently replace the saved scoring definition.

## Series updates retain scoring definitions

Template updates accept and preserve the separately recorded score count and return the persisted scoring definition.

## Competition copies retain scoring and movements

Copying competition events into a series retains rounds, tiebreak, and unique movement links alongside the workout definition.

## Every sync path retains scoring

Mapped updates, name-based adoption, and new event clones preserve rounds, tiebreak, and movement links in the destination competition.

## Scoring changes are visible before sync

Sync previews list rounds and tiebreak changes, and sync status reports the competition as behind when only those scoring fields differ.

## Unknown movement selections reject before writes

Creation checks unique selected movement IDs against the catalog before opening the write transaction, rejecting unknown IDs without partial records.
