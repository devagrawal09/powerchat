# Channel Documents List

## Purpose

Query slice that displays a list of documents in a channel. Documents are clickable to open the document viewer.

## Data

- **Input**:
  - `channelId` (string) - Active channel ID
  - `onDocumentClick` (function) - Callback when user clicks a document
- **Watches**: `documents` query via PowerSync
  - Filters by `channel_id = channelId`
  - Returns: `id`, `title`, `description`
  - Ordered by `created_at DESC` (newest first)
- **Emits**: None

## UI

- Section header: "DOCUMENTS" (uppercase, gray, small font)
- List of document titles as clickable text
- Each document title:
  - Small text, gray-900 color
  - Hover: blue-600 color with underline
  - Cursor pointer
  - Padding for clickable area
- Loading state: Hidden while loading

## Behavior

- Real-time updates via PowerSync watch query
- Displays documents sorted by creation date (newest first)
- Clicking a document calls `onDocumentClick` with the document's ID
- Empty state: No documents shown if none in channel
- Updates automatically when documents are created/deleted in channel
