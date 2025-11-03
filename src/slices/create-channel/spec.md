# Create Channel

## Purpose

Form to create a new channel and auto-join as member.

## Data

- **Input**: `userId` (string) - current user ID
- **Mutates**: PowerSync local DB via `writeTransaction`
  - Inserts into `channels` table
  - Inserts into `channel_members` (user + default assistant agent)
- **Emits**: None (channel list updates via watch query)

## UI

- Text input: placeholder "New channel name"
- Submit button: "Create Channel"
- Disabled state while creating
- Button shows "Creating..." during submission

## Behavior

- Submit on Enter or button click
- Validates: name is required, min 2 chars
- Creates channel with:
  - `id`: new UUID
  - `name`: trimmed input
  - `created_by`: current user
- Auto-adds current user as member
- Auto-adds assistant agent (`00000000-...-001`) as member
- Clears input on success
- Local-first: instant UI update, syncs to Neon via PowerSync
