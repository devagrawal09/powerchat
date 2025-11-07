# Username Check

## Purpose

Query slice that checks if the current user has a registered username.

## Data

- **Reads**: Cookie `pc_username` via `getUsername()`
- **Returns**:
  - `username`: current username string or null
  - `hasUsername`: boolean indicating if username exists
  - `checking`: boolean indicating initial check state

## UI

- No UI - pure query slice that exposes state

## Behavior

- On mount: reads cookie and sets initial state
- Watches for cookie changes via polling and storage events
- Exposes reactive state for consumption by route components
