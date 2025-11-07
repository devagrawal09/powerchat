# Shared Libraries

This directory contains shared utilities and infrastructure concerns that are used across multiple slices. These libraries follow the principle of providing reusable, low-level functionality without containing business logic.

## When to Use Shared Libraries

Shared libraries should be used for:

- **Infrastructure concerns** - Database clients, sync engines, authentication
- **Pure utility functions** - Functions with no side effects or business logic
- **Cross-cutting concerns** - Logging, error handling, common types
- **Framework abstractions** - Wrappers around third-party libraries

## When NOT to Use Shared Libraries

Avoid shared libraries for:

- **Business logic** - Domain-specific rules belong in slices
- **Feature-specific code** - Code used by only one slice belongs in that slice
- **Data transformation** - Feature-specific transformations belong in slices
- **UI components** - Feature-specific components belong in slices

## Available Libraries

### `useWatchedQuery`

**Purpose**: Reactive PowerSync database queries for SolidJS.

**Type**: Infrastructure abstraction

**Usage**:

```typescript
import { useWatchedQuery } from "~/lib/useWatchedQuery";

const messages = useWatchedQuery<MessageRow>(
  () => `SELECT * FROM messages WHERE channel_id = ?`,
  () => [channelId]
);

// Access data: messages.data
// Check loading: messages.loading
// Check error: messages.error
```

**Why it's shared**: All query slices need reactive PowerSync queries. This abstraction handles the complexity of PowerSync's watch API and provides a consistent interface.

**Decision rationale**: This is infrastructure code that wraps PowerSync's watch functionality. It contains no business logic and is purely a technical utility.

---

### `writeTransaction`

**Purpose**: Execute write operations to PowerSync local database.

**Type**: Infrastructure abstraction

**Usage**:

```typescript
import { writeTransaction } from "~/lib/powersync";

await writeTransaction(async (tx) => {
  await tx.execute("INSERT INTO messages (...) VALUES (?)", [values]);
});
```

**Why it's shared**: All mutation slices need to write to the database. This provides a consistent interface and ensures proper transaction handling.

**Decision rationale**: This is infrastructure code that wraps PowerSync's transaction API. It manages the PowerSync client lifecycle and provides a clean transaction interface.

---

### `getUsername`

**Purpose**: Retrieve current user ID from cookie.

**Type**: Pure utility function

**Usage**:

```typescript
import { getUsername } from "~/lib/getUsername";

const username = getUsername();
if (!username) {
  // Handle not authenticated
}
```

**Why it's shared**: Multiple slices need to identify the current user (message sending, channel creation, etc.).

**Decision rationale**: This is a pure utility function with no business logic. It simply extracts a value from cookies. While it could be duplicated, extracting it as a shared utility reduces repetition without coupling slices together.

---

### `getPowerSync`

**Purpose**: Get or initialize the PowerSync database client.

**Type**: Infrastructure singleton

**Usage**:

```typescript
import { getPowerSync } from "~/lib/powersync";

const db = await getPowerSync();
await db.execute("SELECT * FROM messages");
```

**Why it's shared**: PowerSync client must be a singleton - only one instance should exist across the application.

**Decision rationale**: This is infrastructure code that manages the PowerSync client lifecycle. It must be shared to ensure a single database connection.

---

## Guidelines for Adding New Shared Utilities

Before adding a new shared library, ask:

1. **Is this infrastructure or business logic?**
   - Infrastructure → shared library ✓
   - Business logic → belongs in slice ✗

2. **Is this used by multiple slices?**
   - Yes → consider shared library ✓
   - No → keep in slice ✗

3. **Does this couple slices together?**
   - No coupling → safe to share ✓
   - Creates coupling → keep in slices ✗

4. **Can this be a pure function?**
   - Pure function → good candidate ✓
   - Has side effects → evaluate carefully ⚠️

5. **Does this abstract a third-party library?**
   - Yes → probably a good shared utility ✓
   - No → evaluate other criteria ⚠️

## Code Duplication Policy

Per Vertical Slice Architecture principles, **some duplication is acceptable** to maintain slice independence:

- **Rule of Three**: Extract to shared utility only after duplicated **3 times**
- **Slice Independence**: Prefer duplication over coupling slices together
- **Document Duplication**: Add comments explaining why duplication exists and when to extract

Example:

```typescript
// NOTE: This logic is duplicated in chat-messages/index.tsx.
// This is acceptable per VSA principles (slice independence).
// If duplicated a third time, consider extracting to shared utility lib/getAuthorName.ts
const authorName = member.name || "Unknown";
```

## Testing Shared Libraries

Shared libraries should have comprehensive unit tests since they're used across multiple slices:

- Test pure functions with multiple input/output scenarios
- Test error handling and edge cases
- Mock external dependencies (PowerSync, fetch, etc.)
- Ensure backward compatibility when modifying

## Related Documentation

- **Architecture**: See `README.md` for VSA principles
- **ADRs**: See `.research/adr/` for architectural decisions
- **Slice Specs**: See `src/slices/*/spec.md` for feature documentation

