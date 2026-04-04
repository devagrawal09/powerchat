# PowerChat

A real-time chat app with AI agents built with SolidStart, PowerSync, Neon, and Mastra.

## Features

- 💬 Real-time chat channels
- 🤖 AI agents you can @mention in channels
- 📄 Agent-authored documents stored in the database
- 👥 Channel sidebar - view members and agents
- 👤 Agent viewer - click agents to view their description and instructions
- 📱 Offline-first with PowerSync local-first sync
- ⚡ Instant UI updates via client-side writes
- 🔐 Anonymous sessions (no signup required for MVP)

## Tech Stack

- **Frontend**: SolidStart + Solid Router
- **Database**: Neon Postgres
- **Sync**: PowerSync (Web SDK + Service)
- **AI**: Mastra with OpenAI GPT-5
- **Auth**: Anonymous cookie-based sessions

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Database Setup

The database has already been created and seeded via Neon MCP:

- Project: `powerchat` (ID: `morning-tree-55202603`)
- Database: `neondb`
- Tables: `users`, `agents`, `channels`, `channel_members`, `messages`, `documents`, `agent_runs`
- Demo agents: `Assistant`, `Analyst`, `Researcher`, `Writer`

Connection string should be set in `.env.local` (see Environment Variables section below).

### 3. Configure PowerSync Service

PowerSync setup instructions are in `db/replication.sql`. You need to:

- Enable logical replication in Neon
- Create a replication role for PowerSync Service
- Connect PowerSync Service to your Neon database
- Configure sync rules to filter by user membership

### 4. Environment Variables

Create a `.env.local` file with the following variables:

```bash
NEON_DATABASE_URL="postgresql://..."
POWERSYNC_SERVICE_URL=https://your-instance.powersync.com
POWERSYNC_JWT_SECRET=your-secret-min-32-chars
POWERSYNC_JWT_KID=your-key-id
OPENAI_API_KEY=sk-your-key
AI_MODEL=gpt-5
```

**Note**: `POWERSYNC_JWT_SECRET` should be a Base64URL-encoded secret (minimum 32 characters). `POWERSYNC_JWT_KID` is the key ID used in the JWT header.

Also add for client (Vite):

```bash
VITE_POWERSYNC_SERVICE_URL=https://your-instance.powersync.com
```

### 5. Run Development Server

```bash
bun dev
```

### Mock LLM Mode

Run the app without external model calls:

```bash
bun run dev:mock
```

This sets `MOCK_LLM=1` so agents respond with deterministic mock replies.

Visit `http://localhost:3000`

## Usage

1. **Create a Channel**: Use the form in the sidebar
2. **Invite an Agent**: Use the agent invite UI in a channel
3. **Send Messages**: Type in the input box
4. **Mention Agents**: Use `@AgentName` in your message to trigger AI reply
5. **Mention Documents**: Use `#DocumentTitle` to reference stored documents in conversations
6. **View Agent Details**: Click on agents in the right sidebar to see their description and instructions

## Architecture

### Vertical Slice Architecture

PowerChat uses **vertical slice architecture** to organize features by domain rather than by technical layer. Each feature is a self-contained "slice" that includes all the code needed for that feature.

#### Slice Structure

Every slice lives in `src/slices/{feature-name}/` and contains:

- `index.tsx` - The component/hook implementation
- `index.test.tsx` - Test file (see Testing below)

#### Query vs Mutation Slices

Slices are categorized by their primary responsibility:

**Query Slices** (read-only):

- Fetch and display data
- Use PowerSync `useWatchedQuery` for reactive data
- Examples: `channel-list`, `chat-messages`, `username-check`, `channel-header`, `channel-member-list`, `channel-agents-list`, `agent-viewer`, `mention-autocomplete`

**Mutation Slices** (write operations):

- Handle user actions that modify data
- Use PowerSync `writeTransaction` or server actions
- Examples: `create-channel`, `chat-input`, `username-registration`, `channel-invite`, `create-agent`, `delete-channel`

**Key Principle**: Each slice is **either a query OR a mutation**, never both. This ensures clear separation of concerns.

#### Slice Independence

Slices are **completely independent** - they never import or depend on other slices. This means:

- Slices can be developed, tested, and refactored in isolation
- No circular dependencies between features
- Easy to understand what each slice does without reading other code
- Route components orchestrate multiple slices together

#### Route Components Orchestrate Slices

Route components (`src/routes/`) compose multiple slices together:

```tsx
// Example: src/routes/(chat).tsx
import { UsernameCheck } from "~/slices/username-check";
import { UsernameRegistration } from "~/slices/username-registration";
import { ChannelList } from "~/slices/channel-list";

export default function ChatLayout() {
  const usernameCheck = UsernameCheck(); // Query slice
  // ... conditionally render UsernameRegistration based on query state
  // ... render ChannelList and other slices
}
```

### Testing

Every slice **must** have a test file (`index.test.tsx`). Tests can be simple but should verify basic functionality:

- **Query slices**: Test that data renders correctly, loading states work, and empty states are handled
- **Mutation slices**: Test that user interactions trigger the correct mutations and callbacks

#### Test Structure

Tests use Vitest and `@solidjs/testing-library`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { MySlice } from "./index";

// Mock dependencies
vi.mock("~/lib/useWatchedQuery", () => ({
  useWatchedQuery: vi.fn(() => ({ data: [], loading: false })),
}));

describe("MySlice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", () => {
    render(() => <MySlice prop="value" />);
    expect(screen.getByText("Expected text")).toBeInTheDocument();
  });
});
```

#### Running Tests

```bash
bun test
```

#### Test Philosophy

- **Keep tests simple** - Focus on basic functionality, not edge cases
- **Mock external dependencies** - Mock PowerSync queries, server actions, etc.
- **Test behavior, not implementation** - Verify what users see and experience
- **Every slice gets a test** - Even if it's just a few basic assertions

### Client-First Mutations

- Messages are written to local PowerSync SQLite DB instantly
- PowerSync queues uploads to the service
- Server confirms writes
- Replies sync back automatically

### Document Management

Agents can create, list, and read markdown documents within channels:

- **Create Document**: Agents use `createDocument` to store long-form content
- **List Documents**: Agents use `listDocuments` to see available documents
- **Read Document**: Agents use `readDocument` to access document content
- **Document Mentions**: Users and agents can reference documents with `#DocumentTitle`
- **Current UI**: Documents are stored and can be referenced by agents, but the dedicated sidebar list and document viewer were removed from the app shell

### Key Files

- `src/middleware.ts` - Sets anonymous user cookie
- `src/lib/powersync.ts` - PowerSync client + schema
- `src/lib/useWatchedQuery.ts` - Hook for reactive PowerSync queries
- `src/server/powersync.ts` - PowerSync JWT token generation (`getPowerSyncToken`) and upload handler (`uploadData`)
- `src/server/db.ts` - Neon connection pool
- `src/server/agent.ts` - Mastra agent execution and logging
- `src/server/tools/documents.ts` - Document management tools for agents
- `src/routes/(chat).tsx` - Layout with sidebar (orchestrates slices)
- `src/routes/channel/[id].tsx` - Channel shell with header and right sidebar (orchestrates slices)
- `src/slices/` - All feature slices (query and mutation)
- `logs/` - Agent interaction logs (plain text format, git-ignored)

## MVP Limitations

- No server-side validation of mentions/membership
- Anonymous users only (no proper auth)
- No streaming (simple text replies)
- In-memory idempotency (resets on server restart)
- Documents can only be created by agents (no client-side uploads)
- No dedicated document browsing/viewing UI
- No document editing or deletion

## Next Steps

- Add user/agent invite UI
- Server-side membership validation
- Streaming agent responses
- Rate limiting
- Persistent idempotency via DB
- Display names/avatars
- Rich message formatting
- Typing indicators
- Document editing and deletion
- Client-side document creation
- Document search and filtering
