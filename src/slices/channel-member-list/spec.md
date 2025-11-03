# Channel Member List

## Purpose

Shows users and agents in the current channel.

## Data

- **Input**: `channelId` (string) - active channel ID
- **Watches**: `channel_members` query via PowerSync
  - Filters by `channel_id`
  - Joins `users` and `agents` for names
  - Ordered by `member_type, name`
  - Returns: `member_type`, `member_id`, `name`
- **Emits**: None

## UI

- Right sidebar panel (fixed width)
- Collapsible (future enhancement)
- Two sections:
  - **Users** header (uppercase, small, gray)
    - List of user display names
  - **Agents** header (uppercase, small, gray)
    - List of agent names (prefixed with @)
- Loading state while query initializes
- Fallback names:
  - Users → "Anonymous"
  - Agents → "assistant" (for default) or "Agent"

## Behavior

- Real-time updates via PowerSync watch query
- Members appear when added to channel
- No interactions (view-only for MVP)
