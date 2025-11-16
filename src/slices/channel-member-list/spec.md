# Channel Member List

## Purpose

Shows users, agents, and documents in the current channel.

## Data

- **Input**: `channelId` (string) - active channel ID
- **Watches**: Multiple queries via PowerSync
  - `channel_members` query:
  - Filters by `channel_id`
  - Joins `users` and `agents` for names
  - Ordered by `member_type, name`
  - Returns: `member_type`, `member_id`, `name`
  - `documents` query:
    - Filters by `channel_id`
    - Ordered by `created_at DESC`
    - Returns: `id`, `title`, `description`
- **Emits**: None

## UI

- Right sidebar panel (fixed width)
- Collapsible (future enhancement)
- Three sections:
  - **Users** header (uppercase, small, gray)
    - List of user display names
  - **Agents** header (uppercase, small, gray)
    - List of agent names
  - **Documents** header (uppercase, small, gray)
    - List of document titles
- Loading state while queries initialize

## Behavior

- Real-time updates via PowerSync watch queries
- Members and documents appear when added to channel
- No interactions (view-only for MVP)
