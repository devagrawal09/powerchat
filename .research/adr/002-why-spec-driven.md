# ADR-002: Spec-Driven Development

## Status

Accepted

## Context

PowerChat uses Vertical Slice Architecture with multiple independent feature slices. As the application grows, we need:

- **Clear documentation** of what each feature does
- **Consistent structure** across all features
- **Living documentation** that stays up-to-date
- **Design-first approach** to think through features before coding
- **Onboarding guide** for new developers

Traditional approaches:

- **Code-only**: No documentation, hard to understand intent
- **Separate docs**: Get out of sync with implementation
- **Comments**: Too verbose, harder to maintain
- **README**: Too high-level, doesn't cover individual features

## Decision

Every slice follows **spec-driven development**:

1. **Write spec first** - Create `spec.md` before implementing
2. **Consistent format** - All specs follow the same structure
3. **Co-located** - Spec lives alongside implementation
4. **Living documentation** - Update spec when behavior changes

### Spec Structure

```markdown
# Feature Name

## Purpose
Brief description of what this slice does

## Data
- Input: Props/parameters the slice receives
- Watches: PowerSync queries (for query slices)
- Mutates: Data modifications (for mutation slices)
- Emits: Callbacks or events

## UI
Visual description of the component

## Behavior
Step-by-step behavior description
```

## Alternatives Considered

### 1. No Documentation

- **Pros**: Fastest to implement, no maintenance
- **Cons**: Hard to understand, no clear requirements, difficult onboarding
- **Why rejected**: Makes codebase impossible to understand without reading all code

### 2. Traditional Documentation (separate docs/)

- **Pros**: Comprehensive, can be detailed
- **Cons**: Gets out of sync, duplicates effort, not co-located with code
- **Why rejected**: Documentation always drifts from implementation

### 3. JSDoc Comments

- **Pros**: Close to code, IDE support
- **Cons**: Too verbose, clutters code, no high-level view
- **Why rejected**: Doesn't provide feature-level documentation

### 4. Storybook Stories

- **Pros**: Visual documentation, interactive
- **Cons**: Only for UI components, requires setup, harder to write
- **Why rejected**: Too heavy for simple feature documentation

### 5. Tests as Documentation

- **Pros**: Always accurate (tests must pass), shows usage
- **Cons**: Shows "how" not "why", fragmented, hard to get overview
- **Why rejected**: Doesn't capture design intent or behavior clearly

## Consequences

### Positive

- **Clear requirements**: Specs define exactly what needs to be built
- **Design first**: Think through feature before coding
- **Living documentation**: Specs stay up-to-date (part of code review)
- **Onboarding**: New developers read specs to understand features
- **Refactoring safety**: Specs help ensure behavior doesn't change
- **Communication**: Specs facilitate discussion about features
- **Consistency**: All slices follow same structure

### Negative

- **Initial effort**: Must write spec before coding
- **Maintenance**: Must update specs when behavior changes
- **Discipline required**: Team must commit to keeping specs updated
- **No enforcement**: Nothing prevents specs from drifting (except code review)

### Neutral

- **Spec length**: Short slices have short specs, complex slices have detailed specs
- **Spec format**: Markdown is simple but not machine-readable

## Implementation Guidelines

### Writing Specs

1. **Start with Purpose**: One sentence explaining what the slice does
2. **Define Data Flow**: What goes in, what comes out, what's stored
3. **Describe UI**: Visual elements users see
4. **Detail Behavior**: Step-by-step interactions and logic

### Maintaining Specs

- **Update during PR**: Spec changes should be part of feature PRs
- **Review specs**: Code reviewers should verify specs match implementation
- **Mark future work**: Use "Future Enhancements" section for planned features

### When Specs Drift

If spec doesn't match implementation:

- **Option A**: Update spec to match current behavior
- **Option B**: Update code to match spec
- **Option C**: Document as "Known Issue" or "Future Enhancement"

## Examples

### Good Spec Example

```markdown
# Chat Input

## Purpose
Mutation slice for sending messages and triggering agent responses.

## Data
- Input: channelId (string), channelName (string)
- Mutates: messages table via writeTransaction
- Watches: channel_members (to resolve agent mentions)

## UI
- Text input with placeholder
- Send button (disabled when empty)

## Behavior
- Enter or button sends message
- Detects @mentions and triggers agents
- Clears input after send
```

### Poor Spec Example

```markdown
# Chat

Does chat stuff. Has an input and shows messages.
```

## Related

- **ADR-004**: Vertical Slice Architecture
- **ADR-003**: Query/Mutation Separation
- All `src/slices/*/spec.md` files
- `src/lib/README.md` - Shared services documentation

