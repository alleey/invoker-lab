import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so the
 * bundle needs that prefix or every asset 404s and you get a white page.
 * Dev and the Tauri desktop target both load from the root instead.
 * Rename `REPO` if you name the GitHub repository something else.
 */
const REPO = 'invoker-lab';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? `/${REPO}/` : '/',
  server: { port: 5173, strictPort: false },
  build: { target: 'es2022', sourcemap: true },
});
