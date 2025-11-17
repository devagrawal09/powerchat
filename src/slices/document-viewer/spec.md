# Document Viewer

## Purpose

Query slice that displays document content (title, description, markdown content) in a full-screen viewer modal. Used when clicking on a document in the channel sidebar.

## Data

- **Input**:
  - `documentId` (string) - ID of the document to display
  - `onClose` (function) - Callback when user closes the viewer
- **Watches**: `documents` query via PowerSync
  - Filters by `id = documentId`
  - Returns: `id`, `title`, `description`, `content`
- **Emits**: None

## UI

- Full-screen viewer that replaces the chat view
- Header bar with document title and "Close" button
- Scrollable content area with gray background
- Two sections:
  - **Description**: Plain text description of the document
  - **Content**: Markdown-rendered document content
- Max-width container (4xl) centered on page
- Styled with Tailwind classes

## Behavior

- Real-time updates via PowerSync watch query
- Displays document title in header (or "Document" if not loaded)
- Shows description as plain text
- Renders content as markdown
- Close button calls `onClose` callback to return to chat view
- Only renders content when document data is available
