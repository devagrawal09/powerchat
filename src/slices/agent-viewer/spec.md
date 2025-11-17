# Agent Viewer

## Purpose

Query slice that displays agent details (name, description, system instructions) in a full-screen viewer modal. Used when clicking on an agent in the channel sidebar.

## Data

- **Input**:
  - `agentId` (string) - ID of the agent to display
  - `onClose` (function) - Callback when user closes the viewer
- **Watches**: `agents` query via PowerSync
  - Filters by `id = agentId`
  - Returns: `id`, `name`, `description`, `system_instructions`
- **Emits**: None

## UI

- Full-screen viewer that replaces the chat view
- Header bar with agent name and "Close" button
- Scrollable content area with gray background
- Two sections:
  - **Description**: Plain text description of the agent
  - **System Instructions**: Markdown-rendered system instructions
- Max-width container (4xl) centered on page
- Styled with Tailwind classes

## Behavior

- Real-time updates via PowerSync watch query
- Displays agent name in header (or "Agent" if not loaded)
- Shows description as plain text
- Renders system instructions as markdown
- Close button calls `onClose` callback to return to chat view
- Only renders content when agent data is available
