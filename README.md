# PowerChat

A real-time chat app with AI agents built with SolidStart, PowerSync, Neon, and Mastra.

## Features

- 💬 Real-time chat channels
- 🤖 AI agents you can @mention in channels
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
- Tables: `users`, `agents`, `channels`, `channel_members`, `messages`, `message_mentions`
- Demo agent: `Assistant` (ID: `00000000-0000-0000-0000-000000000001`)

Connection string is in `env.md`.

### 3. Configure PowerSync Service

See `POWERSYNC_SETUP.md` for detailed instructions on:

- Enabling logical replication in Neon
- Connecting PowerSync Service to your Neon database
- Configuring sync rules to filter by user membership

### 4. Environment Variables

Copy the values from `env.md` to a `.env.local` file:

```bash
NEON_DATABASE_URL="postgresql://..."
POWERSYNC_SERVICE_URL=https://your-instance.powersync.com
POWERSYNC_JWT_SECRET=your-secret-min-32-chars
OPENAI_API_KEY=sk-your-key
AI_MODEL=gpt-5
```

Also add for client (Vite):

```bash
VITE_POWERSYNC_SERVICE_URL=https://your-instance.powersync.com
```

### 5. Run Development Server

```bash
bun dev
```

Visit `http://localhost:3000`

## Usage

1. **Create a Channel**: Use the form in the sidebar
2. **Invite an Agent**: Use the agent ID `00000000-0000-0000-0000-000000000001` (name: `Assistant`)
   - In a channel, you'd need an invite UI or do it manually via SQL for MVP
3. **Send Messages**: Type in the input box
4. **Mention Agent**: Use `@Assistant` in your message to trigger AI reply

## Architecture

### Vertical Slice Architecture

PowerChat uses **vertical slice architecture** to organize features by domain rather than by technical layer. Each feature is a self-contained "slice" that includes all the code needed for that feature.

#### Slice Structure

Every slice lives in `src/slices/{feature-name}/` and contains:

- `index.tsx` - The component/hook implementation
- `spec.md` - Specification document (see Spec-Driven Development below)
- `index.test.tsx` - Test file (see Testing below)

#### Query vs Mutation Slices

Slices are categorized by their primary responsibility:

**Query Slices** (read-only):

- Fetch and display data
- Use PowerSync `useWatchedQuery` for reactive data
- Examples: `channel-list`, `chat-messages`, `username-check`, `channel-header`

**Mutation Slices** (write operations):

- Handle user actions that modify data
- Use PowerSync `writeTransaction` or server actions
- Examples: `create-channel`, `chat-input`, `username-registration`

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

### Spec-Driven Development

Every slice follows a **spec-driven development** approach:

1. **Write the spec first** (`spec.md`) - Document the feature's purpose, data flow, UI, and behavior
2. **Implement the slice** (`index.tsx`) - Build the component/hook according to the spec
3. **Spec as documentation** - The spec serves as living documentation for the feature

#### Spec Structure

Each `spec.md` follows a consistent format:

```markdown
# Feature Name

## Purpose

Brief description of what this slice does

## Data

- **Input**: Props/parameters the slice receives
- **Watches**: PowerSync queries (for query slices)
- **Mutates**: Data modifications (for mutation slices)
- **Emits**: Callbacks or events

## UI

Visual description of the component

## Behavior

Step-by-step behavior description
```

#### Benefits

- **Clear requirements** - Specs define exactly what needs to be built
- **Living documentation** - Specs stay up-to-date with implementation
- **Onboarding** - New developers can read specs to understand features
- **Refactoring safety** - Specs help ensure behavior doesn't change unexpectedly

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
- Server confirms and agent triggers run server-side
- Replies sync back automatically

### Agent Flow

1. Client detects `@agent` in message
2. Calls `triggerAgent` server function
3. Server fetches recent context from Neon
4. Mastra calls OpenAI GPT-5
5. Agent reply inserted into Neon
6. PowerSync syncs reply to all clients

### Key Files

- `src/middleware.ts` - Sets anonymous user cookie
- `src/lib/powersync.ts` - PowerSync client + schema
- `src/lib/useWatchedQuery.ts` - Hook for reactive PowerSync queries
- `src/routes/api/powersync/token.ts` - JWT endpoint
- `src/server/db.ts` - Neon connection pool
- `src/server/actions.ts` - Server actions (used by mutation slices)
- `src/server/agent.ts` - Mastra agent execution
- `src/routes/(chat).tsx` - Layout with sidebar (orchestrates slices)
- `src/routes/channel/[id].tsx` - Messages view (orchestrates slices)
- `src/slices/` - All feature slices (query and mutation)

## MVP Limitations

- No server-side validation of mentions/membership
- Anonymous users only (no proper auth)
- Single agent response (no multi-agent)
- No streaming (simple text replies)
- In-memory idempotency (resets on server restart)

## Next Steps

- Add user/agent invite UI
- Server-side membership validation
- Streaming agent responses
- Rate limiting
- Persistent idempotency via DB
- Display names/avatars
- Rich message formatting
- Typing indicators
