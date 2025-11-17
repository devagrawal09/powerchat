# Channel Agents List

## Purpose

Query slice that displays a list of agents in a channel. Agents are clickable to open the agent viewer.

## Data

- **Input**:
  - `channelId` (string) - Active channel ID
  - `onAgentClick` (function) - Callback when user clicks an agent
- **Watches**: `channel_members` query via PowerSync
  - Joins with `agents` table to get agent names
  - Filters by `channel_id = channelId` and `member_type = 'agent'`
  - Returns: `member_type`, `member_id`, `name`
  - Ordered by name
- **Emits**: None

## UI

- Section header: "AGENTS" (uppercase, gray, small font)
- List of agent names as clickable text
- Each agent name:
  - Small text, gray-900 color
  - Hover: blue-600 color with underline
  - Cursor pointer
  - Padding for clickable area
- Loading state: Hidden while loading

## Behavior

- Real-time updates via PowerSync watch query
- Displays agents sorted alphabetically by name
- Clicking an agent calls `onAgentClick` with the agent's ID
- Empty state: No agents shown if none in channel
- Updates automatically when agents are added/removed from channel
