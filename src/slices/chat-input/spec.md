# Chat Input

## Purpose

Text input for sending messages with mention autocomplete and agent triggering.

## Data

- **Input**:
  - `channelId` (string) - active channel ID
  - `userId` (string) - current user ID
  - `members` (array) - list of users and agents in channel for autocomplete
- **Mutates**:
  - PowerSync local DB via `writeTransaction` (user message)
  - Calls `streamAgent` server function if agents mentioned
  - Inserts agent response incrementally via `writeTransaction`
- **Emits**: None (messages update via watch query)

## UI

- Text input field spanning width
- Placeholder: "Message #{channel.name}..."
- Send button (blue, disabled when empty)
- Mention autocomplete drop-up (appears above input):
  - Shows filtered members matching query
  - Each item: badge (USER/AGENT) + @name
  - Active item highlighted (blue background)
  - Max height with scroll

## Behavior

### Typing

- Detects `@` followed by letters → opens mention dropdown
- Fuzzy search filters members by name
- Arrow up/down navigates suggestions
- Enter/click inserts `@name ` into input
- Escape closes dropdown

### Sending

- Enter key or Send button submits
- Validation: content must not be empty
- Insert user message with ISO timestamp
- Parse `@mentions` from content
- If agents mentioned:
  - Build conversation history (last 30 messages)
  - Stream agent response
  - Insert placeholder agent message
  - Update incrementally as stream arrives
  - Handle errors by showing `[Agent Error] {message}`
- Clear input on success
- Disable input while sending
- Local-first: instant message appearance
