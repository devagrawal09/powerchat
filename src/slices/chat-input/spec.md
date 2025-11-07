# Chat Input

## Purpose

Mutation-only slice for sending messages and triggering agent responses.

## Data

- **Input**:
  - `channelId` (string) - active channel ID
  - `channelName` (string, optional) - channel name for placeholder text
- **Mutates**:
  - PowerSync local DB via `writeTransaction` (user message)
  - Calls `processAgentResponse` server function if agents mentioned
  - Inserts placeholder "Thinking..." agent message
  - Server updates agent message with actual response
- **Watches**:
  - `channel_members` query - needed to resolve agent IDs from @mention text
- **Emits**: None (messages update via PowerSync watch queries)

## UI

- Text input field
- Placeholder: "Message #{channelName}..."
- Send button (blue, disabled when empty)
- Full width layout with flex gap

## Behavior

### Typing

- Simple text input, no autocomplete (autocomplete extracted to separate slice)
- Users type @mentions manually

### Sending

- Enter key or Send button submits
- Validation: content must not be empty
- Insert user message with ISO timestamp to local PowerSync DB
- Parse `@mentions` from content using regex
- If agents mentioned:
  - Resolve agent names to IDs using channel_members query
  - Insert placeholder "Thinking..." agent message to local DB
  - Call `processAgentResponse` server function with channel ID, agent ID, message ID, and user text
  - Server queries recent message history from Neon
  - Server calls Mastra agent with context
  - Server updates agent message in Neon directly with streamed response
  - PowerSync syncs updated agent message back to all clients
- Clear input on success
- Local-first: instant message appearance
- Agent responses appear incrementally as server updates the message

## Future Enhancements

- Streaming agent responses to client (currently server-side only)
- Real-time message updates as agent streams (currently updates in database)
- Mention autocomplete UI (see `mention-autocomplete` slice)
- Disable input while sending
