# Channel Header

## Purpose

Displays the channel name in the header of the chat view.

## Data

- **Input**: `channelId` (string) - active channel ID
- **Watches**: `channels` query via PowerSync
  - Filters by `id = channelId`
  - Returns: `id`, `name`, `created_by`, `created_at`
- **Emits**: None

## UI

- Header bar at top of chat area
- Shows channel name prefixed with `#`
- Loading state: "Loading..."
- Styled with border-bottom, padding, white background

## Behavior

- Real-time updates via PowerSync watch query
- Displays channel name when loaded
- Updates automatically if channel name changes
