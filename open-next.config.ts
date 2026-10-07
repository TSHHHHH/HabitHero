import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default (in-memory) incremental cache is fine while pages are dynamic.
// Add an R2/KV incremental cache here if we start using ISR or `use cache`.
export default defineCloudflareConfig();
