# Channel Invite

## Purpose

Generate and copy shareable invite link for the current channel.

## Data

- **Input**: `channelId` (string) - active channel ID
- **Mutates**: None (future: will create invite records)
- **Emits**: Copy to clipboard action

## UI

- **Trigger**: Button in member list
  - Text: "Copy Invite Link"
  - Icon: link/chain symbol
- **Modal** (when clicked):
  - Title: "Invite to #{channel.name}"
  - Read-only text input with generated link
  - Copy button (blue)
  - Close button or click outside to dismiss

## Behavior

- Click button → open modal
- Generate link: `{window.location.origin}/invite/{channelId}`
- Click Copy → write to clipboard
- Show feedback: "Copied!" (brief toast or button text change)
- Future: validate invite on landing, auto-join channel
