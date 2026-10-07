import { defineConfig } from "drizzle-kit";

// Migrations are generated here and applied with `wrangler d1 migrations apply`,
// which reads the same folder via `migrations_dir` in wrangler.jsonc.
export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./migrations",
});
