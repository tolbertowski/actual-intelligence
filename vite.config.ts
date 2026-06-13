import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works on GitHub Pages project sites
// (served from /<repo>/) as well as at a domain root, without
// needing to know the repo name at build time.
export default defineConfig({
  base: './',
  plugins: [react()],
});
