# Channel List

## Purpose

Query-only slice that displays all channels the current user is a member of.

## Data

- **Input**: None (uses current user from membership query)
- **Watches**: `channels` query via PowerSync
  - Joins with `channel_members` to filter by user membership
  - Ordered by `created_at DESC`
- **Emits**: Navigation to `/channel/:id` on click

## UI

- Vertical list of channel items
- Each item shows:
  - `# {channel.name}` (link)
  - Delete button (separate mutation slice: `delete-channel`)
- Active channel highlighted (blue background)
- Hover state on non-active items
- Loading state while query initializes
- Empty state: "No channels yet"

## Behavior

- Click channel name → navigate to `/channel/:id`
- Active channel determined by current route params
- Live updates when channels are created/deleted (via PowerSync watch)
- Group hover state reveals delete button
- Delete functionality handled by separate `delete-channel` mutation slice
