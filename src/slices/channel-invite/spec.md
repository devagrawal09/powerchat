# Channel Invite

## Purpose

Mutation slice that invites users to a channel by username.

## Data

- **Input**: `channelId` (string) - active channel ID
- **Mutates**:
  - Calls `inviteByUsername` server action
  - Server adds user to `channel_members` table in Neon
  - PowerSync syncs changes back to clients
- **Emits**: Success/error messages displayed in UI

## UI

- Form in right sidebar (channel member list area)
- Title: "Invite by Username"
- Text input: placeholder "Enter username"
- Submit button: "Add User" (changes to "Adding..." while submitting)
- Success message: "{username} added to channel!" (green, auto-dismisses after 3s)
- Error messages: displayed in red below input

## Behavior

### Validation

- Username input required (cannot be empty)
- Button disabled while submitting or input is empty

### Submission

- Calls `inviteByUsername` server action with channelId and username
- Server validates:
  - User exists
  - User not already a member
- On success:
  - Shows success message
  - Clears input
  - Auto-dismisses message after 3 seconds
  - Member list updates via PowerSync watch query
- On error:
  - Displays error message from server
  - Keeps input value for correction
