# Channel List

## Purpose

Displays all channels the current user is a member of.

## Data

- **Input**: `userId` (string) - current user ID
- **Watches**: `channels` query via PowerSync
  - Filters by user membership
  - Ordered by `created_at DESC`
- **Emits**: Navigation to `/channel/:id` on click

## UI

- Vertical list of channel items
- Each item shows: `# {channel.name}`
- Active channel highlighted (blue background)
- Hover state on non-active items
- Loading state while query initializes
- Empty state: "No channels yet"

## Behavior

- Click channel → navigate to `/channel/:id`
- Active channel determined by current route params
- Live updates when channels are created/deleted
