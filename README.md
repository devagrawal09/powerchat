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
- Demo agent: `assistant` (ID: `00000000-0000-0000-0000-000000000001`)

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
2. **Invite an Agent**: Use the agent ID `00000000-0000-0000-0000-000000000001` (name: `assistant`)
   - In a channel, you'd need an invite UI or do it manually via SQL for MVP
3. **Send Messages**: Type in the input box
4. **Mention Agent**: Use `@assistant` in your message to trigger AI reply

## Architecture

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
- `src/routes/api/powersync/token.ts` - JWT endpoint
- `src/server/db.ts` - Neon connection pool
- `src/server/actions.ts` - Channel/message mutations
- `src/server/agent.ts` - Mastra agent execution
- `src/routes/(chat).tsx` - Layout with sidebar
- `src/routes/channel/[id].tsx` - Messages view

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
