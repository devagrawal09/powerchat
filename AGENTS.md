This is a typescript/bun project. It's a chat app with agent collaboration and delegation.

This project uses Solidjs, SolidStart, Drizzle, and PowerSync.

Most of the app logic is split into vertical slices in src/slices. Any business logic not in these slices should ideally be refactored into slices.
Each slice is a mutation, query, or reaction.

We make use of Solidjs primitives as well as SolidStart "use server" server functions, but no SSR.

Auth is mocked right now.

Project is super experimental, nothing in production, not a serious effort.

This project serves mostly as an experiment of building collaborative agentic apps using PowerSync.

All schema changes and migrations go through Drizzle.

Run tests using `bun run test` not `bun test`.
