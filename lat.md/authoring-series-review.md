# Series Authoring Review

Series creation preserves the definition selected in shared workout fields, and creation callbacks distinguish failed persistence from failed refreshes after success.

## Series dialog preserves selected fields

The real series dialog passes selected rounds, tiebreak, and movements through its parent callback. Failed creation retains those choices for retry instead of dropping them at the adapter boundary.

## Series creation stores selected fields atomically

The server validates rounds, tiebreak, and movement IDs, then stores the workout definition, track link, and movement links in the same transaction. Duplicate movement IDs create only one link per movement.

## Organizer refresh failure follows successful creation

Organizer and cohost creation reset a successfully persisted draft even when router refresh fails. A refresh rejection stays visible as a toast without making an already-created event retryable.
