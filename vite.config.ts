// @lovable.dev/vite-tanstack-config already includes TanStack Start, React,
// Tailwind, tsconfig paths, env injection, and local dev helpers.
// Nitro is added so TanStack Start deploys correctly on Vercel.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  cloudflare: false,
  plugins: [nitro()],
});
