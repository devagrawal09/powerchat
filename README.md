# PowerChat

PowerChat is a real-time local-first chat app for experimenting with collaborative AI agents on top of PowerSync.

Built with SolidStart, PowerSync, Supabase Postgres, Drizzle, and Mastra.

## Features

- 💬 Real-time chat channels
- 🤖 AI agents you can @mention in channels
- ✨ Agent runs triggered directly from message upload handling
- 👥 Right sidebar with channel members and agents
- 🗂️ Live workspace filesystem section in each channel sidebar
- 📱 Offline-first sync with PowerSync local SQLite on web
- ⚡ Instant UI updates via client-side writes
- 🔐 Anonymous cookie-based sessions for MVP

## Tech Stack

- **Frontend**: SolidStart + Solid Router + Tailwind
- **Database**: Supabase Postgres
- **ORM**: Drizzle
- **Sync**: PowerSync (Web SDK + Cloud service)
- **AI**: Mastra
- **Auth**: Anonymous cookie-based sessions + PowerSync JWTs

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Database setup

This app expects a Postgres database with the chat schema already created.

Primary tables used by the app:

- `users`
- `agents`
- `channels`
- `channel_members`
- `messages`
- `agent_runs`
- `workspace_nodes`

Schema source:

- `src/db/schema/server.ts`

Migrations:

- `db/migrations`
- generated with `bun run db:generate`

Set `DATABASE_URL` in your env file.

### 3. PowerSync setup

PowerSync setup is split across a few files:

- `db/replication.sql` — SQL for replication user + publication
- `powersync/service.yaml` — PowerSync service connection config
- `powersync/sync-config.yaml` — sync rules used by app
- `powersync/cli.yaml` — PowerSync CLI project link metadata

For Supabase:

1. Create or update your Postgres connection in `powersync/service.yaml`
2. Ensure the `powersync` publication exists in Supabase
3. Run the SQL in `db/replication.sql` or equivalent SQL manually in Supabase
4. Deploy service config:

```bash
powersync deploy service-config --directory powersync
```

5. Deploy sync config:

```bash
powersync deploy sync-config --directory powersync
```

Current sync rules subscribe each user to channels where they are a member and sync:

- `users`
- `agents`
- `channels`
- `channel_members`
- `messages`
- `agent_runs`
- `workspace_nodes`

### 4. Environment variables

Create a `.env` or `.env.local` file with:

```bash
DATABASE_URL="postgresql://..."
VITE_POWERSYNC_SERVICE_URL="https://<instance>.powersync.journeyapps.com"
POWERSYNC_SERVICE_URL="https://<instance>.powersync.journeyapps.com"
POWERSYNC_JWT_SECRET="<base64url-secret>"
POWERSYNC_JWT_KID="powerchat"
OPENAI_API_KEY="<openai-key>"
AI_MODEL="openrouter/anthropic/claude-haiku-4.5"
```

Notes:

- `POWERSYNC_JWT_SECRET` should match the JWKS/shared-secret configured in PowerSync
- `POWERSYNC_JWT_KID` should match the configured key id
- `VITE_POWERSYNC_SERVICE_URL` is used by browser client
- `POWERSYNC_SERVICE_URL` is used by server token generation

### 5. Run app

```bash
bun run dev
```

Default dev server:

- `http://localhost:9009`

## Usage

1. Choose a username
2. Create or open a channel
3. Send messages normally
4. Mention an agent with `@AgentName` to trigger an AI reply
5. Use the right sidebar to:
   - inspect members
   - inspect agents
   - inspect live workspace filesystem metadata for channel

## Workspace filesystem metadata

Each channel has a workspace on the server filesystem under `.mastra-workspaces/channels/<channel-id>`.

The app watches those directories and projects metadata into `workspace_nodes`, which is then synced down through PowerSync. The sidebar tree is metadata-only in current version:

- file/folder name
- relative path
- kind (`file` / `dir`)
- size for files
- modified time

No file preview or editing yet.

## Architecture

### Vertical slice architecture

PowerChat organizes UI behavior by feature slice instead of technical layer.

Each slice usually lives in `src/slices/{feature-name}/` and contains:

- `index.tsx` — component/hook implementation
- `index.test.tsx` — colocated tests when present

Route components in `src/routes/` compose slices together.

### Query vs mutation slices

**Query slices**:

- fetch and render data
- use `useQuery` from `~/lib/powersync-solid`

Examples:

- `channel-list`
- `chat-messages`
- `channel-header`
- `channel-member-list`
- `channel-agents-list`
- `channel-workspace-tree`
- `agent-viewer`
- `mention-autocomplete`

**Mutation slices**:

- handle writes and user actions
- use PowerSync write transactions or server actions

Examples:

- `create-channel`
- `chat-input`
- `username-registration`
- `channel-invite`
- `create-agent`
- `delete-channel`

### Client-first mutations

- Messages are written to local PowerSync SQLite first
- PowerSync queues uploads to service
- Upload handler validates and writes to Postgres with Drizzle
- New user messages can trigger agent runs directly from upload path
- Agent replies stream back into persisted messages
- Workspace filesystem metadata is indexed on server and synced through `workspace_nodes`

## Testing

Run tests with:

```bash
bun run test
```

Useful targeted commands:

```bash
bunx vitest run src
bunx vitest run src/server/workspace-node-indexer.test.ts
bunx tsc --noEmit
```

Test philosophy:

- keep tests simple
- mock external dependencies where useful
- test behavior, not implementation details
- prefer colocated slice tests

## Project status

Experimental project. Not production app. Main purpose is exploring collaborative agentic apps with PowerSync.
