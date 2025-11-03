# Chat Messages

## Purpose

Displays message history for a channel in chronological order.

## Data

- **Input**: `channelId` (string) - active channel ID
- **Watches**: `messages` query via PowerSync
  - Filters by `channel_id`
  - Joins `users` and `agents` for author names
  - Ordered by `created_at ASC, id ASC`
  - Returns: `id`, `author_type`, `author_id`, `author_name`, `content`, `created_at`
- **Emits**: None

## UI

- Scrollable message list
- Each message shows:
  - Avatar circle with first letter of author name
  - Author name (bold)
  - Timestamp (small, gray)
  - Message content
- Auto-scrolls to bottom on new messages
- Loading state: "Loading messages..."
- Empty state: "No messages yet"

## Behavior

- Real-time updates via PowerSync watch query
- Messages appear instantly when sent (local-first)
- Author names fallback gracefully if not synced:
  - Users → "Anonymous"
  - Agents → "assistant" or "Agent"
  - System → "System"
