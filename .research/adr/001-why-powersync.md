# ADR-001: Why PowerSync for Data Synchronization

## Status

Accepted

## Context

PowerChat is a real-time chat application that needs to:

- Support offline-first functionality
- Provide instant UI updates without waiting for server responses
- Sync data across multiple clients in real-time
- Handle conflicts when users modify data offline
- Work seamlessly with a Postgres database (Neon)

We needed a solution that would:

1. Provide local-first data storage in the browser
2. Automatically sync changes to a central database
3. Handle bidirectional sync (client → server → client)
4. Resolve conflicts intelligently
5. Work with our existing Postgres database

## Decision

We chose **PowerSync** as our data synchronization solution.

PowerSync provides:

- **Local SQLite database** in the browser using WASM
- **Reactive queries** that automatically update when data changes
- **Automatic sync** to Postgres via PowerSync Service
- **Conflict resolution** built-in (last-write-wins by default)
- **Postgres logical replication** for server → client sync
- **CRUD upload queue** for client → server sync

## Alternatives Considered

### 1. Direct API Calls with Polling

- **Pros**: Simple, no additional infrastructure
- **Cons**: Not offline-first, poor UX (waiting for server), high latency, excessive API calls
- **Why rejected**: Doesn't provide local-first experience or real-time updates

### 2. WebSockets with Manual State Management

- **Pros**: Real-time updates, bidirectional communication
- **Cons**: Complex state management, no offline support, difficult conflict resolution, must implement sync logic
- **Why rejected**: Too much complexity to build and maintain custom sync logic

### 3. Supabase Realtime

- **Pros**: Real-time updates, Postgres integration
- **Cons**: Not local-first, still requires network for queries, no offline support
- **Why rejected**: Doesn't provide local-first architecture or offline functionality

### 4. ElectricSQL

- **Pros**: Local-first, Postgres sync, similar to PowerSync
- **Cons**: Less mature, smaller ecosystem, more opinionated about data modeling
- **Why rejected**: PowerSync was more mature and better documented at evaluation time

### 5. Replicache

- **Pros**: Local-first, framework agnostic
- **Cons**: Requires custom backend integration, no native Postgres support, more complex setup
- **Why rejected**: PowerSync's Postgres integration and PowerSync Service made it easier to adopt

## Consequences

### Positive

- **Instant UI updates**: Users see their changes immediately without waiting for server
- **Offline support**: App works without network connection, syncs when reconnected
- **Real-time sync**: Changes from other users appear automatically via reactive queries
- **Simplified client code**: No need to manually manage API calls or state synchronization
- **Postgres integration**: Works seamlessly with existing Neon Postgres database
- **Conflict resolution**: Built-in conflict handling reduces edge cases

### Negative

- **Additional infrastructure**: Requires PowerSync Service (hosted or self-hosted)
- **Learning curve**: Team needs to learn PowerSync APIs and concepts
- **Database size**: Local SQLite database grows with data (mitigated by sync rules)
- **Setup complexity**: Requires configuring logical replication and sync rules
- **Vendor dependency**: Tied to PowerSync ecosystem

### Neutral

- **Schema duplication**: Must define schema in both Postgres and PowerSync client
- **Query language**: Uses SQL instead of a query builder or ORM
- **Authentication**: Must implement PowerSync JWT token generation
- **Sync rules**: Must define data filtering rules (e.g., only sync user's channels)

## Implementation Notes

### PowerSync Setup

1. **Database**: Use Neon Postgres with logical replication enabled
2. **PowerSync Service**: Configure connection to Neon and sync rules
3. **Client**: Initialize PowerSync with schema and connector
4. **Authentication**: Generate JWT tokens with user ID claim

### Integration with SolidStart

PowerSync integrates cleanly with SolidStart:

- `useWatchedQuery` hook provides reactive queries for SolidJS
- `writeTransaction` for client-side mutations
- Server functions handle JWT token generation
- Server functions process agent responses and write to Neon

### Migration Path

If we need to migrate away from PowerSync in the future:

1. Replace `useWatchedQuery` with direct API calls
2. Replace `writeTransaction` with API mutations
3. Remove PowerSync client initialization
4. Keep Neon Postgres as source of truth

Most application logic (slices) would remain unchanged since they use abstracted PowerSync APIs.

## Related

- **ADR-002**: Spec-Driven Development
- **ADR-004**: Vertical Slice Architecture
- `src/lib/powersync.ts` - PowerSync client implementation
- `src/lib/useWatchedQuery.ts` - Reactive query hook
- `src/server/powersync.ts` - Server-side PowerSync integration

