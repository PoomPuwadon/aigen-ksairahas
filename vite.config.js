import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works from any subpath (e.g. GitHub Pages
  // project sites at username.github.io/repo-name/) without extra config.
  base: './',
});
