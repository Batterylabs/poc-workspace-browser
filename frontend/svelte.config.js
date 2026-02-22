import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  // Enable preprocessing for TypeScript, PostCSS inside Svelte files
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Enable Svelte 4 runes mode preparation (no-op in Svelte 4)
  },
}
