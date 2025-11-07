# Delete Channel

## Purpose

Mutation-only slice that handles channel deletion.

## Data

- **Input**:
  - `channelId` (string) - ID of channel to delete
  - `onDelete` (callback, optional) - called after successful deletion
- **Mutates**:
  - Deletes channel from PowerSync local DB via `writeTransaction`
  - PowerSync queues upload to sync service
- **Emits**:
  - `onDelete()` callback when deletion succeeds

## UI

- Delete button (× symbol)
- Shows on hover over channel list item
- Styling:
  - Gray by default
  - Red on hover
  - Opacity controlled by group hover state

## Behavior

### Deletion

- Click button triggers deletion
- Uses `writeTransaction` to delete from local DB
- PowerSync syncs deletion to server automatically
- No confirmation dialog (MVP - add later if needed)
- Button prevents event bubbling to parent (doesn't trigger navigation)
