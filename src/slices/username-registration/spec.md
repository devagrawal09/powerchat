# Username Registration

## Purpose

Mutation slice that handles user registration via username selection.

## Data

- **Input**: Username string from form input
- **Mutates**:
  - Calls `registerUsername` server action
  - Sets `pc_username` cookie on success
- **Emits**: `onSuccess` callback with registered username

## UI

- Modal overlay with form
- Text input for username
- Submit button ("Continue")
- Error message display
- Loading state during submission

## Behavior

- Validates username format (3-30 chars, alphanumeric + hyphens/underscores)
- Calls server action to register username
- Sets cookie on success
- Triggers `onSuccess` callback to notify parent
- Shows error messages for validation/server errors
