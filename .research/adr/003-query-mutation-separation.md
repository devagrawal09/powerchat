# ADR-003: Query/Mutation Separation Principle

## Status

Accepted

## Context

In Vertical Slice Architecture, each slice represents a complete feature. We needed to decide how to organize slices that both read and write data.

Key questions:

- Should slices be allowed to both query and mutate?
- How should we handle UI components that display data and allow modifications?
- What's the right level of granularity for slices?

## Decision

**Each slice is either a query OR a mutation, never both.**

### Query Slices (Read-Only)

- Use `useWatchedQuery` to fetch and display data
- No `writeTransaction` calls
- No server action calls that modify data
- Focus on presenting information to users
- Examples: `channel-list`, `chat-messages`, `channel-header`

### Mutation Slices (Write Operations)

- Use `writeTransaction` or call server actions
- May include minimal queries needed for the mutation logic
- Focus on handling user actions that modify data
- Examples: `create-channel`, `chat-input`, `delete-channel`

### Exceptions

Mutation slices MAY include queries if:

- The query is necessary to execute the mutation (e.g., resolving IDs)
- The query is not for displaying data to users
- The query is minimal and tightly coupled to the mutation logic

Example: `chat-input` queries `channel_members` to resolve agent mentions from names to IDs.

## Rationale

This separation follows **CQRS** (Command Query Responsibility Segregation) principles:

1. **Clear responsibilities**: Each slice has one job
2. **Easier testing**: Test reads and writes separately
3. **Better scalability**: Queries and mutations can be optimized independently
4. **Simpler reasoning**: Know what a slice does by its type
5. **Reduced coupling**: Changes to display logic don't affect mutation logic

## Alternatives Considered

### 1. Allow Mixed Query/Mutation Slices

- **Pros**: Fewer slices, everything in one place
- **Cons**: Complex slices, harder to test, violates single responsibility
- **Why rejected**: Leads to large, complex slices that are hard to maintain

### 2. Strict CQRS (No Queries in Mutations)

- **Pros**: Purest form of CQRS, complete separation
- **Cons**: Sometimes mutations need data to execute correctly
- **Why rejected**: Too strict for practical development, requires workarounds

### 3. Group by Data Model (e.g., ChannelSlice)

- **Pros**: All channel-related code in one place
- **Cons**: Not feature-centric, doesn't follow VSA principles
- **Why rejected**: Goes against Vertical Slice Architecture

## Consequences

### Positive

- **Clear separation of concerns**: Read and write logic are separate
- **Easier testing**: Can test queries without mocking mutations
- **Better caching**: Query slices can be cached/memoized without side effects
- **Supports CQRS**: Natural fit for CQRS architecture if needed later
- **Simpler components**: Each slice has focused responsibility

### Negative

- **More files**: More slices mean more files to manage
- **Orchestration**: Route components must compose multiple slices
- **Learning curve**: New pattern for developers used to mixed CRUD

### Neutral

- **Slice size**: Most slices are small and focused
- **Duplication**: Some UI duplication (different slices render similar elements)

## Implementation Guidelines

### Creating New Slices

Ask: "Does this primarily read or write data?"

- Primarily reads → Query slice
- Primarily writes → Mutation slice
- Both equally → Split into two slices

### Composing Slices

Route components orchestrate query and mutation slices:

```tsx
// Route composes slices
<ChatMessages channelId={id} />  {/* Query slice */}
<ChatInput channelId={id} />     {/* Mutation slice */}
```

### When Mutations Need Queries

If a mutation needs data:

1. **For execution**: Query within mutation slice (acceptable exception)
2. **For display**: Pass data as props from a query slice
3. **For validation**: Consider server-side validation

Example (acceptable):

```typescript
// chat-input (mutation slice)
// Queries members to resolve agent mentions
const members = useWatchedQuery(...);  // OK: needed for mutation logic
```

Example (not acceptable):

```typescript
// create-channel (mutation slice)
const channels = useWatchedQuery(...);  // NOT OK: querying for display
```

### Slice Naming

- Query slices: Noun/noun-phrase (e.g., `channel-list`, `chat-messages`)
- Mutation slices: Verb-phrase (e.g., `create-channel`, `delete-channel`, `chat-input`)

## Examples

### Query Slice: `channel-list`

- Queries channels from database
- Displays list of channels
- No mutations (delete extracted to `delete-channel`)

### Mutation Slice: `create-channel`

- Form to create new channel
- Writes to database
- No queries (except internal validation if needed)

### Mixed (After Refactoring): `chat-input` + `mention-autocomplete`

Before refactoring:

- `chat-input` did both queries (for autocomplete) and mutations (sending)

After refactoring:

- `chat-input` - Mutation slice for sending messages
- `mention-autocomplete` - Query slice for displaying suggestions (future)

## Related

- **ADR-004**: Vertical Slice Architecture
- **ADR-002**: Spec-Driven Development
- Review document: `.research/powerchat-vsa-review.md` - Original analysis
