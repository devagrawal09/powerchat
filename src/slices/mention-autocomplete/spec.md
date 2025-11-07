# Mention Autocomplete

## Purpose

Query-only slice that provides mention autocomplete UI for typing @mentions in chat input.

## Data

- **Input**:
  - `channelId` (string) - active channel ID
  - `mentionQuery` (string) - current mention query text
  - `isOpen` (boolean) - whether autocomplete should be visible
  - `activeIndex` (number) - currently highlighted option
  - `onSelect` (callback) - called when user selects a mention
  - `onActiveIndexChange` (callback) - called when active index changes
- **Watches**:
  - `channel_members` query via PowerSync
  - Fetches users and agents in the channel for autocomplete
- **Emits**:
  - `onSelect(name: string)` when user clicks or presses Enter on a mention
  - `onActiveIndexChange(index: number)` when active index changes

## UI

- Dropdown positioned above input (drop-up)
- Shows filtered members matching query
- Each item displays:
  - Type badge (USER/AGENT) in uppercase gray text
  - @name in dark text
- Active item has blue background
- Max height with scroll overflow
- Only visible when `isOpen` is true and matches exist

## Behavior

### Filtering

- Fuzzy search filters members by name
- Case-insensitive matching
- Returns all members if query is empty

### Interaction

- Hover over item sets it as active (calls `onActiveIndexChange`)
- Click on item selects it (calls `onSelect`)
- Mouse down prevents input blur
- Updates reactively when channelId or mentionQuery changes
