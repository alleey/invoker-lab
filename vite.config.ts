import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Which build this is: the short commit, nothing else.
 *
 * Actions sets GITHUB_SHA for free, so nothing has to be wired into the
 * workflow. Locally it falls back to asking git, and to `dev` when there is no
 * git at all — a build must never fail over a label.
 */
function buildId(): string {
  const sha = (process.env.GITHUB_SHA ?? tryGit('rev-parse --short=7 HEAD')).slice(0, 7);
  return sha || 'dev';
}

function tryGit(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

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
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  server: { port: 5173, strictPort: false },
  build: { target: 'es2022', sourcemap: true },
});
