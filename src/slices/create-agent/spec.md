# Create Agent

## Purpose

Mutation slice that allows users to create new AI agents with name, system instructions, and description. Includes validation and duplicate checking.

## Data

- **Input**:
  - `channelId` (string) - Channel ID (for context, not directly used)
  - `onSuccess` (optional function) - Callback after successful creation
- **Watches**: `agents` query via PowerSync (for duplicate checking)
  - Returns: `id`, `name` for all agents
- **Mutates**:
  - Inserts new row into `agents` table via PowerSync `writeTransaction`
  - Fields: `id`, `name`, `system_instructions`, `description`, `model_config`, `created_at`
- **Emits**: Success/error messages displayed in UI

## UI

- Collapsible form in right sidebar (bottom section)
- Closed state: "Create Agent" button
- Open state: Form with:
  - Title: "Create Agent"
  - Text input: Agent name (required)
  - Textarea: System instructions (4 rows, required)
  - Textarea: Description (2 rows, required)
  - Success/error message display
  - Submit button: "Create" (disabled while submitting or fields empty)
  - Cancel button: Closes form and clears fields

## Behavior

### Validation

- All fields required (cannot be empty)
- Agent name must be at least 2 characters
- Agent name can only contain letters, numbers, hyphens, and underscores
- Agent name must be unique (case-insensitive check against existing agents)
- Submit button disabled while submitting or any field is empty

### Submission

- On submit:
  1. Trim all input values
  2. Validate all rules
  3. Check for duplicate name
  4. Generate UUID for agent ID
  5. Insert into PowerSync local DB via `writeTransaction`
  6. Show success message: `Agent "{name}" created!`
  7. Clear all fields
  8. Auto-close form after 2 seconds
  9. Call `onSuccess` callback if provided
- On error:
  - Display error message in red
  - Keep form open for correction
- On cancel:
  - Close form
  - Clear all fields
  - Clear any messages

### PowerSync Sync

- Agent creation written to local PowerSync DB instantly
- PowerSync syncs to Neon automatically
- Other clients see new agent via PowerSync watch queries
