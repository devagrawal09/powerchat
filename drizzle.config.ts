import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/server.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
