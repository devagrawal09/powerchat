# ADR-004: Why Vertical Slice Architecture

## Status

Accepted

## Context

PowerChat needed an architecture that supports:

- Multiple independent features (channels, messages, agents, users)
- Real-time updates via PowerSync
- Rapid feature development
- Easy refactoring and maintenance
- Clear feature boundaries

Traditional architecture approaches:

- **Layered Architecture**: Separate by technical concern (controllers, services, repositories)
- **Feature Folders**: Group by feature but still layered internally
- **Monolithic Components**: Large components with mixed concerns
- **Domain-Driven Design**: Heavy focus on domain modeling

## Decision

We chose **Vertical Slice Architecture (VSA)** where each feature is organized as an independent "slice" containing all code needed for that feature.

### Key Principles

1. **Feature-centric organization**: Organize by business capability, not technical layer
2. **Slice independence**: Slices don't import from other slices
3. **Complete features**: Each slice contains everything it needs
4. **Minimal coupling**: Slices communicate via shared data (PowerSync) or orchestration
5. **Spec-driven**: Each slice has a specification document

### Structure

```
src/slices/
  ├── chat-messages/      # Query: Display messages
  │   ├── index.tsx
  │   └── spec.md
  ├── chat-input/         # Mutation: Send messages
  │   ├── index.tsx
  │   └── spec.md
  └── create-channel/     # Mutation: Create channels
      ├── index.tsx
      └── spec.md
```

## Alternatives Considered

### 1. Layered Architecture

```
src/
  ├── components/
  ├── services/
  ├── repositories/
  └── models/
```

- **Pros**: Familiar, clear separation of technical concerns
- **Cons**: Changes to one feature touch multiple files, hard to find related code
- **Why rejected**: Feature changes require modifying many layers, hard to maintain

### 2. Feature Folders with Layers

```
src/features/
  └── chat/
      ├── components/
      ├── services/
      └── models/
```

- **Pros**: Features grouped together, better than pure layers
- **Cons**: Still layered internally, doesn't prevent tight coupling
- **Why rejected**: Internal layers still make features complex and coupled

### 3. Component-Based (React/SolidJS Default)

```
src/components/
  ├── ChatMessages.tsx
  ├── ChatInput.tsx
  └── ChannelList.tsx
```

- **Pros**: Simple, familiar to React/SolidJS developers
- **Cons**: No structure for business logic, components become bloated
- **Why rejected**: Leads to "smart components" with mixed concerns

### 4. Domain-Driven Design

- **Pros**: Rich domain models, clear business logic
- **Cons**: Heavy overhead for simple CRUD, requires domain expertise
- **Why rejected**: Too complex for a chat app, PowerSync handles most domain logic

### 5. Atomic Design

```
src/
  ├── atoms/
  ├── molecules/
  ├── organisms/
  └── pages/
```

- **Pros**: Reusable UI components, clear hierarchy
- **Cons**: Focused on UI only, doesn't handle business logic
- **Why rejected**: Only addresses component structure, not full features

## Consequences

### Positive

- **Feature isolation**: Work on one feature without affecting others
- **Easier onboarding**: New developers can understand one slice at a time
- **Faster development**: Add new features without touching existing code
- **Easier testing**: Test slices independently
- **Clear boundaries**: Each slice has a single responsibility
- **Better refactoring**: Change one slice without ripple effects
- **Parallel development**: Multiple developers can work on different slices

### Negative

- **Initial setup**: Requires more structure upfront
- **More files**: More slices mean more directories and files
- **Acceptable duplication**: Must accept some code duplication for independence
- **Discipline required**: Team must follow VSA principles
- **Learning curve**: New pattern for many developers

### Neutral

- **Slice granularity**: Must decide when to split features into multiple slices
- **Shared utilities**: Some infrastructure must be shared (PowerSync, auth)
- **Orchestration**: Routes must compose multiple slices

## Implementation Guidelines

### Creating New Slices

1. Identify the feature/capability
2. Create directory: `src/slices/{feature-name}/`
3. Write spec first: `spec.md`
4. Implement: `index.tsx`
5. Add tests (optional but recommended): `index.test.tsx`

### Slice Independence

**Never import from other slices:**

```typescript
// ❌ BAD: Direct slice import
import { ChannelList } from "~/slices/channel-list";

// ✅ GOOD: Import from shared lib
import { useWatchedQuery } from "~/lib/useWatchedQuery";
```

### Route Orchestration

Routes compose multiple slices:

```typescript
export default function ChannelPage() {
  const params = useParams();
  return (
    <>
      <ChannelHeader channelId={params.id} />
      <ChatMessages channelId={params.id} />
      <ChatInput channelId={params.id} />
    </>
  );
}
```

### Shared Utilities

Extract to `src/lib/` only when:

- Used by 3+ slices (rule of three)
- Infrastructure/utility, not business logic
- Doesn't couple slices together

See `src/lib/README.md` for guidelines.

### Code Duplication

Prefer duplication over coupling:

```typescript
// Acceptable: Same logic in two slices
// Each slice is independent
// Extract only if duplicated 3+ times
```

## Real-World Fit

VSA is ideal for PowerChat because:

1. **Multiple distinct features**: Channels, messages, agents, users
2. **Real-time sync**: PowerSync handles data consistency
3. **Rapid development**: New features are independent
4. **Clear boundaries**: Chat, channels, and agents are separate domains

VSA would be less ideal for:

- Single-page apps with one main feature
- Apps requiring complex domain models
- Apps with heavy shared business logic

## Metrics of Success

How we measure if VSA is working:

1. **Feature additions**: New features don't require changing existing slices
2. **Bug fixes**: Fixes are isolated to single slices
3. **Testing**: Slices can be tested independently
4. **Onboarding**: New developers understand features quickly
5. **Refactoring**: Changes don't ripple across codebase

## Related

- **ADR-001**: PowerSync (enables slice independence via data sync)
- **ADR-002**: Spec-Driven Development (each slice has a spec)
- **ADR-003**: Query/Mutation Separation (how to organize slices)
- Review: `.research/vertical-slice-architecture-research.md` - VSA research
- Review: `.research/powerchat-vsa-review.md` - Architecture review

